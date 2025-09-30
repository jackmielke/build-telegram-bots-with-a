import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkflowCheck {
  is_enabled: boolean;
  configuration: {
    chat_types?: {
      private?: boolean;
      group?: boolean;
      supergroup?: boolean;
    };
  };
}

// Get chat type from Telegram message
function getChatType(message: any): 'private' | 'group' | 'supergroup' | 'unknown' {
  if (!message?.chat) return 'unknown';
  
  switch (message.chat.type) {
    case 'private':
      return 'private';
    case 'group':
      return 'group';
    case 'supergroup':
      return 'supergroup';
    default:
      return 'unknown';
  }
}

// Circuit breaker function - checks if workflow is enabled
async function isWorkflowEnabled(
  supabase: any, 
  communityId: string, 
  workflowType: string
): Promise<WorkflowCheck | null> {
  try {
    const { data, error } = await supabase
      .from('community_workflows')
      .select('is_enabled, configuration')
      .eq('community_id', communityId)
      .eq('workflow_type', workflowType)
      .single();

    if (error) {
      console.error('Error checking workflow status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Circuit breaker error:', error);
    return null;
  }
}

// Resolve the Telegram bot token for a given community
async function getBotToken(supabase: any, communityId: string): Promise<string | null> {
  try {
    const { data: community, error: commErr } = await supabase
      .from('communities')
      .select('telegram_bot_token')
      .eq('id', communityId)
      .maybeSingle();
    if (!commErr && community?.telegram_bot_token) {
      return community.telegram_bot_token as string;
    }
  } catch (e) {
    console.error('Error fetching community bot token:', e);
  }

  try {
    const { data: bot, error: botErr } = await supabase
      .from('telegram_bots')
      .select('bot_token')
      .eq('community_id', communityId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!botErr && bot?.bot_token) {
      return bot.bot_token as string;
    }
  } catch (e) {
    console.error('Error fetching telegram bot record:', e);
  }

  const envToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (envToken) return envToken;
  return null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('Telegram webhook received:', body);

    // Determine community from querystring or body
    const url = new URL(req.url);
    const communityId = url.searchParams.get('community_id') || body.community_id || null;

    if (!communityId) {
      console.log('Missing community_id in webhook URL');
      return new Response(JSON.stringify({ ok: true, message: 'Missing community_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    
    // CIRCUIT BREAKER: Check if telegram integration is enabled
    const workflowStatus = await isWorkflowEnabled(
      supabase, 
      communityId, 
      'telegram_integration'
    );

    if (!workflowStatus || !workflowStatus.is_enabled) {
      console.log('Telegram integration is disabled for community:', communityId);
      
      // Return success to Telegram but don't process the message
      return new Response(JSON.stringify({ 
        ok: true, 
        message: 'Workflow disabled' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log('Telegram integration is enabled, checking chat type permissions...');
    
    // Only process if workflow is enabled
    if (body.message) {
      // Get the chat type from the message
      const chatType = getChatType(body.message);
      console.log('Message chat type:', chatType);
      
      // Handle unknown chat types
      if (chatType === 'unknown') {
        console.log('Unknown chat type, rejecting message for community:', communityId);
        return new Response(JSON.stringify({ 
          ok: true, 
          message: 'Unknown chat type',
          chat_type: chatType,
          workflow_enabled: true,
          chat_type_enabled: false
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }
      
      // Check if this specific chat type is enabled
      const chatTypeEnabled = workflowStatus.configuration?.chat_types?.[chatType];
      
      if (!chatTypeEnabled) {
        console.log(`Chat type '${chatType}' is disabled for community:`, communityId);
        
        // Return success to Telegram but don't process the message
        return new Response(JSON.stringify({ 
          ok: true, 
          message: `Chat type '${chatType}' disabled`,
          chat_type: chatType,
          workflow_enabled: true,
          chat_type_enabled: false
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }

      console.log(`Processing ${chatType} message:`, body.message.text);
      
      // Get AI response and send back to Telegram
      try {
        const chatId = body.message?.chat?.id;
        if (!chatId) {
          console.log('No chat id found in message, cannot reply');
        } else {
          const botToken = await getBotToken(supabase, communityId);
          
          // Send typing indicator immediately
          if (botToken) {
            fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                action: 'typing'
              })
            }).catch(err => console.log('Error sending typing indicator:', err));
          }
          if (!botToken) {
            console.error('No Telegram bot token configured for community:', communityId);
          } else {
            // Get community agent configuration
            const { data: communityData } = await supabase
              .from('communities')
              .select('agent_instructions, agent_name, agent_model, agent_max_tokens, agent_temperature')
              .eq('id', communityId)
              .single();

            // Fetch community memories/knowledge
            const { data: memories } = await supabase
              .from('memories')
              .select('content')
              .eq('community_id', communityId)
              .order('created_at', { ascending: false })
              .limit(10);

            // Build system prompt with memories
            let systemPrompt = communityData?.agent_instructions || 'You are a helpful community assistant.';
            
            if (memories && memories.length > 0) {
              systemPrompt += '\n\nCommunity Knowledge:\n' + 
                memories.map(m => m.content).join('\n---\n');
            }

            const userMessage = body.message?.text || 'Hello';
            
            // Call OpenAI for AI response
            const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
            if (!openaiApiKey) {
              console.error('OpenAI API key not configured');
              throw new Error('AI service not configured');
            }

            const model = communityData?.agent_model || 'gpt-4o-mini';
            const isLegacyModel = model.includes('gpt-4o') || model.includes('gpt-3.5');
            
            // Build request body based on model type
            const requestBody: any = {
              model,
              messages: [
                {
                  role: 'system',
                  content: systemPrompt
                },
                {
                  role: 'user',
                  content: userMessage
                }
              ]
            };

            // Use correct token parameter based on model
            if (isLegacyModel) {
              requestBody.max_tokens = communityData?.agent_max_tokens || 2000;
              requestBody.temperature = communityData?.agent_temperature || 0.7;
            } else {
              requestBody.max_completion_tokens = communityData?.agent_max_tokens || 2000;
              // Newer models don't support temperature parameter
            }

            const startTime = Date.now();
            const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });

            if (!aiResponse.ok) {
              console.error('OpenAI API error:', await aiResponse.text());
              throw new Error('Failed to get AI response');
            }

            const aiData = await aiResponse.json();
            const replyText = aiData.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
            const responseTime = Date.now() - startTime;

            // 🚀 SEND TO TELEGRAM IMMEDIATELY (don't wait for analytics)
            const telegramPromise = fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: replyText,
                parse_mode: 'HTML',
                disable_web_page_preview: true,
              }),
            });

            // 📊 DO ANALYTICS IN BACKGROUND (non-blocking)
            const analyticsTask = async () => {
              try {
                const tokensUsed = aiData.usage?.total_tokens || 0;
                const promptTokens = aiData.usage?.prompt_tokens || 0;
                const completionTokens = aiData.usage?.completion_tokens || 0;
                
                // Model-specific pricing
                let costPer1kInput = 0.00015;
                let costPer1kOutput = 0.0006;
                
                if (model.includes('gpt-4o-mini')) {
                  costPer1kInput = 0.00015;
                  costPer1kOutput = 0.0006;
                } else if (model.includes('gpt-4o')) {
                  costPer1kInput = 0.0025;
                  costPer1kOutput = 0.01;
                }
                
                const estimatedCost = (promptTokens / 1000 * costPer1kInput) + (completionTokens / 1000 * costPer1kOutput);

                console.log(`📊 Analytics: ${tokensUsed} tokens, ${responseTime}ms, $${estimatedCost.toFixed(6)}`);

                // Insert analytics record
                const { error: insertError } = await supabase
                  .from('ai_chat_sessions')
                  .insert({
                    community_id: communityId,
                    chat_type: 'telegram_bot',
                    model_used: model,
                    tokens_used: tokensUsed,
                    cost_usd: estimatedCost,
                    message_count: 1,
                    metadata: {
                      response_time_ms: responseTime,
                      telegram_chat_id: chatId,
                      telegram_user_id: body.message?.from?.id,
                      chat_type_detail: chatType
                    }
                  });

                if (insertError) {
                  console.error('❌ Analytics insert error:', insertError);
                }
              } catch (err) {
                console.error('❌ Analytics background task error:', err);
              }
            };

            // Wait for Telegram response and log result
            const tgResp = await telegramPromise;
            const tgData = await tgResp.json().catch(() => null);
            
            if (!tgResp.ok) {
              console.error('❌ Telegram sendMessage failed:', tgData || tgResp.statusText);
            } else {
              console.log('✅ Telegram sendMessage ok:', tgData);
            }

            // Run analytics in background (don't block response)
            analyticsTask().catch(err => console.error('Background analytics failed:', err));
          }
        }
      } catch (sendErr) {
        console.error('Error sending Telegram reply:', sendErr);
      }
      
      return new Response(JSON.stringify({ 
        ok: true,
        processed: true,
        workflow_enabled: true,
        chat_type_enabled: true,
        chat_type: chatType
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in telegram webhook:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});