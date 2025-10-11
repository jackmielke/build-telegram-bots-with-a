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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { chatSessionId, triggerType = 'scheduled' } = await req.json();

    console.log('🤖 Proactive outreach triggered:', { chatSessionId, triggerType });

    // Fetch chat session details
    const { data: chatSession, error: sessionError } = await supabase
      .from('telegram_chat_sessions')
      .select('*, communities(*), telegram_bots(*)')
      .eq('id', chatSessionId)
      .single();

    if (sessionError || !chatSession) {
      throw new Error(`Chat session not found: ${sessionError?.message}`);
    }

    // Check if outreach is enabled
    if (!chatSession.proactive_outreach_enabled && triggerType === 'scheduled') {
      console.log('⏭️ Skipping - proactive outreach not enabled');
      return new Response(JSON.stringify({ skipped: true, reason: 'not_enabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if already sent recently (within 20 hours for scheduled, allow manual anytime)
    if (triggerType === 'scheduled' && chatSession.last_outreach_at) {
      const lastOutreach = new Date(chatSession.last_outreach_at);
      const hoursSinceLastOutreach = (Date.now() - lastOutreach.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastOutreach < 20) {
        console.log(`⏭️ Skipping - last outreach was ${hoursSinceLastOutreach.toFixed(1)} hours ago`);
        return new Response(JSON.stringify({ 
          skipped: true, 
          reason: 'too_recent',
          hours_since_last: hoursSinceLastOutreach 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Fetch recent chat history (last 30 messages)
    const { data: messages } = await supabase
      .from('messages')
      .select('content, sent_by, created_at')
      .eq('community_id', chatSession.community_id)
      .eq('metadata->>telegram_chat_id', chatSession.telegram_chat_id.toString())
      .order('created_at', { ascending: false })
      .limit(30);

    // Fetch community memories
    const { data: memories } = await supabase
      .from('memories')
      .select('content, tags, created_at')
      .eq('community_id', chatSession.community_id)
      .order('created_at', { ascending: false })
      .limit(50);

    // Build context for AI
    const chatHistory = messages?.slice(0, 20).reverse().map(m => 
      `${m.sent_by === 'ai' ? 'Assistant' : 'User'}: ${m.content}`
    ).join('\n') || 'No recent messages.';

    const memoryContext = memories?.slice(0, 30).map(m => 
      `• ${m.content}${m.tags?.length ? ` [${m.tags.join(', ')}]` : ''}`
    ).join('\n') || 'No memories stored.';

    const userName = chatSession.telegram_first_name || chatSession.telegram_username || 'there';

    // Create AI prompt for generating personalized outreach
    const systemPrompt = `You are a helpful AI assistant reaching out proactively to engage the user.

Your goal: Share something interesting, relevant, or useful that the user might not know but would appreciate.

Community Context:
${chatSession.communities?.name || 'Community'}
${chatSession.communities?.description || ''}

Community Knowledge:
${memoryContext}

Recent Chat History:
${chatHistory}

Instructions:
- Be friendly, warm, and conversational
- Share something valuable: a fact they might not know, an update, a helpful tip, or an interesting connection
- Keep it brief (2-3 sentences max)
- Don't just ask "how are you?" - provide value
- Reference their interests or past conversations when relevant
- Sound natural and human, not like a notification

Generate a single proactive message for ${userName}:`;

    console.log('🤖 Generating personalized outreach message...');

    // Call AI to generate personalized message
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a personalized proactive message for ${userName}.` }
        ],
        max_tokens: 200,
        temperature: 0.8
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const generatedMessage = aiData.choices[0].message.content;

    console.log('💬 Generated message:', generatedMessage.substring(0, 100));

    // Send message via Telegram
    const botToken = chatSession.telegram_bots?.bot_token;
    if (!botToken) {
      throw new Error('Bot token not found');
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatSession.telegram_chat_id,
        text: generatedMessage,
        parse_mode: 'Markdown'
      })
    });

    const telegramData = await telegramResponse.json();
    
    if (!telegramData.ok) {
      throw new Error(`Telegram API error: ${telegramData.description}`);
    }

    console.log('✅ Message sent successfully');

    // Log the outreach
    await supabase.from('outreach_logs').insert({
      chat_session_id: chatSession.id,
      community_id: chatSession.community_id,
      telegram_chat_id: chatSession.telegram_chat_id,
      message_sent: generatedMessage,
      trigger_type: triggerType,
      ai_prompt: systemPrompt,
      success: true,
      metadata: {
        message_id: telegramData.result.message_id,
        messages_used: messages?.length || 0,
        memories_used: memories?.length || 0
      }
    });

    // Update last_outreach_at on chat session
    await supabase
      .from('telegram_chat_sessions')
      .update({ last_outreach_at: new Date().toISOString() })
      .eq('id', chatSession.id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: generatedMessage,
      telegram_message_id: telegramData.result.message_id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in proactive outreach:', error);

    // Try to log the failure if we have enough context
    try {
      const { chatSessionId } = await req.json();
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: chatSession } = await supabase
        .from('telegram_chat_sessions')
        .select('community_id, telegram_chat_id')
        .eq('id', chatSessionId)
        .single();

      if (chatSession) {
        await supabase.from('outreach_logs').insert({
          chat_session_id: chatSessionId,
          community_id: chatSession.community_id,
          telegram_chat_id: chatSession.telegram_chat_id,
          message_sent: '',
          trigger_type: 'manual',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
