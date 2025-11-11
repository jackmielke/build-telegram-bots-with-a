import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HIGGSFIELD_API_KEY = Deno.env.get("HIGGSFIELD_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!HIGGSFIELD_API_KEY) {
      throw new Error("HIGGSFIELD_API_KEY not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { videoId } = await req.json();

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "videoId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch video record from database
    const { data: videoRecord, error: fetchError } = await supabase
      .from("bot_videos")
      .select("*")
      .eq("id", videoId)
      .single();

    if (fetchError || !videoRecord) {
      throw new Error("Video record not found");
    }

    // If already completed or failed, return cached result
    if (videoRecord.status === "completed" || videoRecord.status === "failed") {
      return new Response(
        JSON.stringify({
          videoId: videoRecord.id,
          status: videoRecord.status,
          videoUrl: videoRecord.video_url,
          thumbnailUrl: videoRecord.thumbnail_url,
          errorMessage: videoRecord.error_message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check status with Higgsfield API
    let jobId = videoRecord.generation_metadata?.id;

    // If job hasn't been created yet (e.g., provider downtime), try to bootstrap it now
    if (!jobId && (videoRecord.status === "queued" || videoRecord.status === "processing")) {
      try {
        console.log("Bootstrapping Higgsfield job for queued video:", videoRecord.id);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const createResp = await fetch("https://api.higgsfield.ai/api/v1/video-generations", {
          method: "POST",
          headers: { "Authorization": `Bearer ${HIGGSFIELD_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: videoRecord.prompt,
            model: videoRecord.model || "higgsfield/realistic-vision-v5",
            duration: videoRecord.duration || 5,
            resolution: videoRecord.resolution || "1080p",
            ...(videoRecord.source_image_url && { image_url: videoRecord.source_image_url }),
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (createResp.ok) {
          const created = await createResp.json();
          jobId = created.id;
          const { error: upErr } = await supabase
            .from("bot_videos")
            .update({ status: "processing", generation_metadata: created })
            .eq("id", videoId);
          if (upErr) console.error("Failed to update video after job creation:", upErr);
        } else {
          const errText = await createResp.text();
          console.error("Higgsfield create error:", createResp.status, errText);
          if ([522,503,504].includes(createResp.status)) {
            // Keep queued and return current state to avoid 500s
            return new Response(
              JSON.stringify({
                videoId: videoRecord.id,
                status: videoRecord.status || "queued",
                videoUrl: videoRecord.video_url,
                thumbnailUrl: videoRecord.thumbnail_url,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          // For other errors, surface a message but avoid crashing client
          return new Response(
            JSON.stringify({
              videoId: videoRecord.id,
              status: videoRecord.status || "queued",
              errorMessage: `Provider error (${createResp.status}) starting job`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e: any) {
        console.error("Error bootstrapping job:", e?.message || e);
        // Keep queued status and return gracefully
        return new Response(
          JSON.stringify({
            videoId: videoRecord.id,
            status: videoRecord.status || "queued",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!jobId) {
      // Still no jobId; return current DB status instead of throwing
      return new Response(
        JSON.stringify({
          videoId: videoRecord.id,
          status: videoRecord.status || "queued",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Checking Higgsfield status for job:", jobId);

    const higgsResponse = await fetch(`https://api.higgsfield.ai/api/v1/video-generations/${jobId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${HIGGSFIELD_API_KEY}`,
      },
    });

    if (!higgsResponse.ok) {
      const errorText = await higgsResponse.text();
      console.error("Higgsfield API error (status check):", higgsResponse.status, errorText);
      if ([522,503,504].includes(higgsResponse.status)) {
        // Provider temporarily unavailable; return current known state
        return new Response(
          JSON.stringify({
            videoId: videoRecord.id,
            status: videoRecord.status || "processing",
            videoUrl: videoRecord.video_url,
            thumbnailUrl: videoRecord.thumbnail_url,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          videoId: videoRecord.id,
          status: videoRecord.status || "processing",
          errorMessage: `Provider error (${higgsResponse.status}) while checking status`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const higgsData = await higgsResponse.json();
    console.log("Higgsfield status response:", higgsData);

    // Update database based on status
    let updateData: any = {
      generation_metadata: higgsData,
    };

    if (higgsData.status === "completed" && higgsData.video_url) {
      updateData.status = "completed";
      updateData.video_url = higgsData.video_url;
      updateData.thumbnail_url = higgsData.thumbnail_url;
      updateData.completed_at = new Date().toISOString();
    } else if (higgsData.status === "failed") {
      updateData.status = "failed";
      updateData.error_message = higgsData.error || "Video generation failed";
    } else {
      updateData.status = "processing";
    }

    const { error: updateError } = await supabase
      .from("bot_videos")
      .update(updateData)
      .eq("id", videoId);

    if (updateError) {
      console.error("Database update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        videoId: videoRecord.id,
        status: updateData.status,
        videoUrl: updateData.video_url,
        thumbnailUrl: updateData.thumbnail_url,
        errorMessage: updateData.error_message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error checking video status:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});