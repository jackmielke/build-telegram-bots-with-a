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

    const { communityId, videoType = "intro", customPrompt, sourceImageUrl } = await req.json();

    if (!communityId) {
      return new Response(
        JSON.stringify({ error: "communityId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch community data for context
    const { data: community, error: communityError } = await supabase
      .from("communities")
      .select("name, agent_name, agent_instructions, description, agent_avatar_url")
      .eq("id", communityId)
      .single();

    if (communityError || !community) {
      throw new Error("Community not found");
    }

    // Build prompt based on video type
    let finalPrompt = customPrompt;
    if (!finalPrompt) {
      const botName = community.agent_name || community.name;
      const botDescription = community.agent_instructions || community.description || "a helpful AI assistant";

      switch (videoType) {
        case "intro":
          finalPrompt = `Cinematic character reveal of ${botName}, an AI bot. Camera slowly zooms into a futuristic holographic display showing a friendly AI avatar. Modern tech aesthetic with blue and purple neon lighting. Professional, welcoming atmosphere. 4K quality, smooth motion.`;
          break;
        case "promo":
          finalPrompt = `Promotional video for ${botName} AI bot. Dynamic montage showing the bot's capabilities with floating UI elements, data streams, and holographic interfaces. Upbeat, energetic mood with vibrant colors. Professional tech commercial style.`;
          break;
        case "token_reveal":
          finalPrompt = `Epic token launch animation for ${botName}. Golden particles swirl and coalesce into a glowing cryptocurrency token. The token rotates majestically as light rays emanate from it. Triumphant, celebratory atmosphere with sparkles and lens flares. Cinematic 4K quality.`;
          break;
        default:
          finalPrompt = `High-quality video featuring ${botName}. ${botDescription}. Professional, cinematic style.`;
      }
    }

    console.log("Generating video with prompt:", finalPrompt);

    // Call Higgsfield API to generate video with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let higgsResponse;
    try {
      higgsResponse = await fetch("https://api.higgsfield.ai/api/v1/video-generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HIGGSFIELD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          model: "higgsfield/realistic-vision-v5", // Free model
          duration: 5, // 5 seconds
          resolution: "1080p",
          ...(sourceImageUrl && { image_url: sourceImageUrl }),
        }),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error("Higgsfield API timeout");
        throw new Error("Higgsfield API is not responding. The service may be temporarily unavailable. Please try again in a few minutes.");
      }
      throw new Error(`Failed to connect to Higgsfield API: ${fetchError.message}`);
    }
    
    clearTimeout(timeoutId);

    if (!higgsResponse.ok) {
      const errorText = await higgsResponse.text();
      console.error("Higgsfield API error:", higgsResponse.status, errorText);
      
      // Check for specific error codes
      if (higgsResponse.status === 522 || higgsResponse.status === 503 || higgsResponse.status === 504) {
        throw new Error("Higgsfield API is temporarily unavailable (server timeout). Please try again in a few minutes.");
      }
      if (higgsResponse.status === 429) {
        throw new Error("Higgsfield API rate limit exceeded. Please wait a moment and try again.");
      }
      if (higgsResponse.status === 401 || higgsResponse.status === 403) {
        throw new Error("Higgsfield API authentication failed. Please check your API key configuration.");
      }
      
      throw new Error(`Higgsfield API error (${higgsResponse.status}): Service unavailable`);
    }

    const higgsData = await higgsResponse.json();
    console.log("Higgsfield response:", higgsData);

    // Store video generation job in database
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: userRecord } = await supabase
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const { data: videoRecord, error: insertError } = await supabase
      .from("bot_videos")
      .insert({
        community_id: communityId,
        video_type: videoType,
        prompt: finalPrompt,
        source_image_url: sourceImageUrl,
        model: "higgsfield/realistic-vision-v5",
        status: "processing",
        resolution: "1080p",
        duration: 5,
        generation_metadata: higgsData,
        created_by: userRecord?.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
      throw insertError;
    }

    console.log("Video generation job created:", videoRecord.id);

    return new Response(
      JSON.stringify({
        success: true,
        videoId: videoRecord.id,
        jobId: higgsData.id,
        status: "processing",
        message: "Video generation started. Use check-video-status to poll for completion.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating video:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});