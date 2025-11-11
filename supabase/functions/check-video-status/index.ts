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
    const jobId = videoRecord.generation_metadata?.id;
    if (!jobId) {
      throw new Error("No job ID found in video record");
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
      console.error("Higgsfield API error:", errorText);
      throw new Error(`Higgsfield API error: ${higgsResponse.status}`);
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