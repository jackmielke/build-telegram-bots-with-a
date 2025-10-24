import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, communityId, singleMessage, userId } = await req.json();
    
    if (!conversationId && !singleMessage) {
      return new Response(
        JSON.stringify({ error: 'conversationId or singleMessage is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!communityId) {
      return new Response(
        JSON.stringify({ error: 'communityId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch messages from the conversation or use single message
    let conversationText = '';
    let detectedUserId = userId;
    
    if (singleMessage) {
      // Use the single message provided
      conversationText = singleMessage;
    } else if (conversationId) {
      // Fetch messages from database
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          *,
          users:sender_id (
            name,
            telegram_username
          )
        `)
        .eq('conversation_id', conversationId)
        .eq('community_id', communityId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch messages' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!messages || messages.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No messages found in conversation' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user_id from first user message if not provided
      if (!detectedUserId) {
        const firstUserMessage = messages.find(msg => msg.sent_by !== 'ai');
        detectedUserId = firstUserMessage?.sender_id;
      }

      // Format the conversation for the AI
      conversationText = messages.map(msg => {
        const sender = msg.sent_by === 'ai' ? 'AI Assistant' : (msg.users?.name || msg.users?.telegram_username || 'User');
        return `${sender}: ${msg.content}`;
      }).join('\n\n');
    } else {
      return new Response(
        JSON.stringify({ error: 'Either conversationId or singleMessage must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert at creating professional, well-formatted intro summaries from conversations.

Your task is to analyze the conversation and create a structured intro that follows this exact format:

[Name] (@[username]) is [nationality/location], based in [location], and [background/origin story]. [Current work/role and key projects]. [Specific ongoing project or initiative].

[Core passion/interest and how it drives their work]. Outside of professional work, [hobbies/personal interests]. [What they're excited about/looking forward to].

Example of a well-formatted intro:

Angelica Vidal (@angelicagvidal) is French-American, based in Paris, and grew up as an expat between France, England, and The Netherlands. She runs Marble Fountain, a brand strategy and experiences agency, and has been collaborating with human.tech for the past year. She is organizing the Human Tech residency at Edge Patagonia from November 5–15, aiming to bring together people from diverse walks of life in a shared space with a common goal.

Angelica is passionate about exploring how curiosity can help us live, build, and connect more deeply as humans. Outside of her professional work, she enjoys thrift shopping, collecting unique objects and fabrics, and creating one-of-one handbags entirely from recycled materials. She's excited to connect, exchange perspectives, and co-create meaningful experiences in Patagonia.

Guidelines:
- Keep it concise (2-3 paragraphs max)
- Focus on the person's background, work, passions, and interests
- Include username if mentioned
- Maintain a professional yet warm tone
- Extract concrete details from the conversation
- Only include information that was explicitly mentioned

Return ONLY the intro text, nothing else.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is the conversation to analyze:\n\n${conversationText}` }
        ],
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedIntro = data.choices?.[0]?.message?.content?.trim();

    if (!generatedIntro) {
      throw new Error('Failed to generate intro');
    }

    // Save intro to user's bio field if userId is provided
    if (detectedUserId) {
      console.log('Saving intro to user bio:', detectedUserId);
      const { error: updateError } = await supabase
        .from('users')
        .update({ bio: generatedIntro })
        .eq('id', detectedUserId);

      if (updateError) {
        console.error('Error updating user bio:', updateError);
        // Don't fail the request, just log the error
      } else {
        console.log('✅ Intro saved to user bio');
      }
    }

    return new Response(
      JSON.stringify({ 
        intro: generatedIntro,
        userId: detectedUserId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-intro function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
