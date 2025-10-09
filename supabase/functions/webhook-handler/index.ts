import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request
    const { message, api_key } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Missing "message" field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!api_key) {
      return new Response(
        JSON.stringify({ error: 'Missing "api_key" field' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 Validating API key...');

    // Validate API key and get community
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('id, name, agent_instructions, agent_name, agent_model, webhook_enabled, webhook_request_count')
      .eq('webhook_api_key', api_key)
      .single();

    if (communityError || !community) {
      console.error('❌ Invalid API key');
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!community.webhook_enabled) {
      console.error('❌ Webhook not enabled for this community');
      return new Response(
        JSON.stringify({ error: 'Webhook not enabled for this community' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Valid API key for community: ${community.name} (${community.id})`);

    // Update webhook usage stats
    const currentCount = community.webhook_request_count || 0;
    await supabase
      .from('communities')
      .update({
        webhook_request_count: currentCount + 1,
        webhook_last_used_at: new Date().toISOString()
      })
      .eq('id', community.id);

    // Fetch all memories from the community
    console.log('🧠 Fetching community memories...');
    const { data: memories } = await supabase
      .from('memories')
      .select('content, created_at, tags')
      .eq('community_id', community.id)
      .order('created_at', { ascending: false })
      .limit(100);

    let memoriesContext = '';
    if (memories && memories.length > 0) {
      const formatted = memories
        .map((m: any) => {
          const date = new Date(m.created_at).toLocaleDateString();
          const tags = m.tags?.length > 0 ? ` [${m.tags.join(', ')}]` : '';
          return `• ${m.content} (${date})${tags}`;
        })
        .join('\n');
      
      memoriesContext = `\n\n📚 COMMUNITY KNOWLEDGE BASE (${memories.length} memories):\n${formatted}`;
    }

    // Build system prompt with community config and memories
    const agentName = community.agent_name || 'Assistant';
    const systemPrompt = `You are ${agentName}, a helpful AI assistant for ${community.name}.
Current time: ${new Date().toISOString()}

${community.agent_instructions || 'Be helpful, friendly, and concise.'}${memoriesContext}`;

    console.log('🤖 Calling OpenRouter AI...');
    
    // Use agent model or default to gpt-4o
    const model = community.agent_model || 'openai/gpt-4o';
    
    console.log(`Using model: ${model}`);
    
    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://superconnector.app',
        'X-Title': 'SuperConnector Webhook'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ AI API error:', aiResponse.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: 'AI service unavailable',
          details: errorText 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices[0].message.content;
    const tokensUsed = aiData.usage?.total_tokens || 0;

    console.log(`✅ AI response generated (${tokensUsed} tokens)`);

    // Log analytics
    await supabase.from('ai_chat_sessions').insert({
      community_id: community.id,
      user_id: null,
      chat_type: 'webhook',
      model_used: model,
      tokens_used: tokensUsed,
      cost_usd: 0, // Calculate based on model pricing if needed
      message_count: 1,
      session_start_at: new Date().toISOString(),
      session_end_at: new Date().toISOString(),
      metadata: {
        source: 'webhook_api',
        request_timestamp: new Date().toISOString()
      }
    });

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        response: responseText,
        metadata: {
          community: community.name,
          model: model,
          tokens_used: tokensUsed,
          memories_loaded: memories?.length || 0
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
