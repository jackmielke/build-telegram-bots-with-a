import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      voiceDescription,
      previewId,
      agentName, 
      agentInstructions,
      communityId 
    } = await req.json();
    
    console.log("Received parameters:", { 
      hasVoiceDescription: !!voiceDescription, 
      hasPreviewId: !!previewId, 
      hasCommunityId: !!communityId,
      voiceDescription: voiceDescription?.substring(0, 50),
      previewId,
      communityId
    });
    
    if (!voiceDescription || !previewId || !communityId) {
      const missing = [];
      if (!voiceDescription) missing.push("voiceDescription");
      if (!previewId) missing.push("previewId");
      if (!communityId) missing.push("communityId");
      throw new Error(`Missing required parameters: ${missing.join(", ")}`);
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key not configured");
    }

    console.log("Creating voice from preview for community:", communityId);

    // Step 1: Create voice from the preview ID
    const voiceResponse = await fetch('https://api.elevenlabs.io/v1/text-to-voice/create-voice-from-preview', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice_name: `${agentName || 'Community'} Voice`,
        voice_description: voiceDescription,
        generated_voice_id: previewId,
      })
    });

    if (!voiceResponse.ok) {
      const errorText = await voiceResponse.text();
      console.error("Voice creation error:", errorText);
      throw new Error(`Failed to create voice: ${voiceResponse.status}`);
    }

    const voiceData = await voiceResponse.json();
    const voiceId = voiceData.voice_id;
    console.log("Voice created with ID:", voiceId);

    // Step 2: Create the conversational AI agent with this voice
    const agentResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_config: {
          agent: {
            prompt: {
              prompt: agentInstructions || "You are a helpful community assistant."
            },
            first_message: `Hello! I'm ${agentName || 'your community assistant'}. How can I help you today?`,
            language: "en"
          },
          tts: {
            voice_id: voiceId
          }
        }
      })
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      console.error("Agent creation error:", errorText);
      throw new Error(`Failed to create agent: ${agentResponse.status}`);
    }

    const agentData = await agentResponse.json();
    const agentId = agentData.agent_id;
    console.log("Agent created with ID:", agentId);

    // Step 3: Save agent ID to community
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: updateError } = await supabaseAdmin
      .from('communities')
      .update({ elevenlabs_agent_id: agentId })
      .eq('id', communityId);

    if (updateError) {
      console.error("Database update error:", updateError);
      throw new Error(`Failed to save agent ID: ${updateError.message}`);
    }

    console.log("Agent ID saved to community");

    return new Response(
      JSON.stringify({ 
        agentId,
        voiceId,
        success: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in elevenlabs-create-agent:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
