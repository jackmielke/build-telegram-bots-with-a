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
    agent_tools?: {
      web_search?: boolean;
      search_memory?: boolean;
      search_chat_history?: boolean;
      save_memory?: boolean;
      search_profiles?: boolean;
    };
    auto_intro_generation?: {
      enabled?: boolean;
      thread_names?: string[]; // e.g., ["intros", "introductions", "introduce yourself"]
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

// Fetch Telegram profile photo
async function getTelegramProfilePhoto(
  botToken: string,
  userId: number
): Promise<string | null> {
  try {
    // Get user profile photos
    const photosResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${userId}&limit=1`
    );
    const photosData = await photosResponse.json();
    
    if (!photosData.ok || !photosData.result.photos || photosData.result.photos.length === 0) {
      console.log(`No profile photo found for user ${userId}`);
      return null;
    }
    
    // Get the largest photo (last in the array)
    const photos = photosData.result.photos[0];
    const largestPhoto = photos[photos.length - 1];
    
    // Get file path
    const fileResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${largestPhoto.file_id}`
    );
    const fileData = await fileResponse.json();
    
    if (!fileData.ok || !fileData.result.file_path) {
      console.log(`Could not get file path for photo ${largestPhoto.file_id}`);
      return null;
    }
    
    // Return the full URL to the photo
    const photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
    console.log(`Found profile photo for user ${userId}: ${photoUrl}`);
    return photoUrl;
  } catch (error) {
    console.error('Error fetching Telegram profile photo:', error);
    return null;
  }
}

// Find or create user based on Telegram info
async function findOrCreateUser(
  supabase: any,
  botToken: string,
  telegramUserId: number,
  telegramUsername: string | null,
  firstName: string | null,
  lastName: string | null
): Promise<string | null> {
  try {
    // First try to find existing user by telegram_user_id (most reliable)
    const { data: existingUserById } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_user_id', telegramUserId)
      .maybeSingle();
    
    if (existingUserById) {
      console.log(`Found existing user by telegram_user_id: ${telegramUserId}`);
      return existingUserById.id;
    }

    // Try to find by telegram_username
    if (telegramUsername) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_username', telegramUsername)
        .maybeSingle();
      
      if (existingUser) {
        console.log(`Found existing user by telegram_username: ${telegramUsername}`);
        // Update their telegram_user_id
        await supabase
          .from('users')
          .update({ telegram_user_id: telegramUserId })
          .eq('id', existingUser.id);
        return existingUser.id;
      }
      
      // Try to find by username field (in case they signed up via app first)
      const { data: userByUsername } = await supabase
        .from('users')
        .select('id, telegram_username')
        .eq('username', telegramUsername)
        .maybeSingle();
      
      if (userByUsername) {
        // Update their telegram info if not set
        await supabase
          .from('users')
          .update({ 
            telegram_username: telegramUsername,
            telegram_user_id: telegramUserId 
          })
          .eq('id', userByUsername.id);
        console.log(`Updated telegram info for existing user: ${telegramUsername}`);
        return userByUsername.id;
      }
    }

    // If not found, create new unclaimed user profile
    const displayName = firstName 
      ? `${firstName}${lastName ? ' ' + lastName : ''}`
      : telegramUsername || `telegram_user_${telegramUserId}`;

    // Generate unique username by adding telegram user ID if needed
    let username = telegramUsername || `tg_${telegramUserId}`;
    
    // Check if username exists and make it unique if needed
    const { data: usernameCheck } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    
    if (usernameCheck) {
      username = `${username}_tg${telegramUserId}`;
    }

    // Fetch profile photo from Telegram
    const photoUrl = await getTelegramProfilePhoto(botToken, telegramUserId);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        name: displayName,
        telegram_username: telegramUsername,
        telegram_user_id: telegramUserId,
        telegram_photo_url: photoUrl,
        username: username,
        is_claimed: false,
        avatar_url: photoUrl // Also set avatar_url for app display
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return null;
    }

    console.log(`Created new unclaimed profile: ${username} (${displayName}) with photo`);
    return newUser.id;
  } catch (error) {
    console.error('Error in findOrCreateUser:', error);
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

// Check if bot is mentioned in message
function isBotMentioned(message: any, botUsername?: string): boolean {
  if (!message) return false;
  
  // Check if message has entities (mentions, commands, etc.)
  if (message.entities) {
    for (const entity of message.entities) {
      if (entity.type === 'mention' || entity.type === 'text_mention') {
        const text = message.text || '';
        const mentionText = text.substring(entity.offset, entity.offset + entity.length);
        if (botUsername && mentionText.includes(botUsername)) {
          return true;
        }
      }
      // Bot commands: only respond if command is for this bot or is generic
      if (entity.type === 'bot_command' && botUsername) {
        const text = message.text || '';
        const commandText = text.substring(entity.offset, entity.offset + entity.length);
        
        // Check if command is directed at this bot specifically (e.g., /start@thisbot)
        if (commandText.includes(`@${botUsername}`)) {
          return true;
        }
        
        // If command has no @ suffix, it's a generic command (respond in DMs only)
        // In groups, ignore generic commands unless they mention this bot
        if (!commandText.includes('@')) {
          // Only respond to generic commands in private chats
          const chatType = message.chat?.type;
          return chatType === 'private';
        }
        
        // Command is for a different bot (e.g., /start@otherbot)
        return false;
      }
    }
  }
  
  // Check for @botusername in text
  if (botUsername && message.text) {
    return message.text.includes(`@${botUsername}`);
  }
  
  return false;
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
      
      // Check message age - don't respond to messages older than 2 minutes
      const messageDate = body.message?.date;
      if (messageDate) {
        const messageAge = Date.now() / 1000 - messageDate; // age in seconds
        if (messageAge > 120) { // 2 minutes
          console.log(`Message too old (${messageAge}s), skipping response`);
          return new Response(JSON.stringify({ 
            ok: true, 
            message: 'Message too old',
            skipped: true
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          });
        }
      }
      
      // Get AI response and send back to Telegram
      try {
        const chatId = body.message?.chat?.id;
        if (!chatId) {
          const errorMsg = 'No chat id found in message, cannot reply';
          console.error(errorMsg);
          
          // Log error to database for monitoring
          await supabase.from('ai_chat_sessions').insert({
            community_id: communityId,
            user_id: null,
            chat_type: 'telegram',
            model_used: 'none',
            tokens_used: 0,
            cost_usd: 0,
            message_count: 0,
            metadata: { 
              error: errorMsg,
              chat_type: getChatType(body.message),
              timestamp: new Date().toISOString()
            }
          });
          
          return new Response(JSON.stringify({ 
            ok: false, 
            error: errorMsg 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        } else {
          // Extract message text (support text, captions, photos, documents)
          const message = body.message;
          let userMessage = message?.text || message?.caption || 'Hello';
          const hasPhoto = !!message?.photo;
          const hasDocument = !!message?.document;
          
          // Enhance message context for multi-modal content
          if (hasPhoto) {
            userMessage = `[Photo${message.caption ? `: ${message.caption}` : ''}]`;
          } else if (hasDocument) {
            const fileName = message.document?.file_name || 'document';
            userMessage = `[Document: ${fileName}${message.caption ? ` - ${message.caption}` : ''}]`;
          }
          
          const telegramUserId = body.message?.from?.id;
          const telegramUsername = body.message?.from?.username;
          const firstName = body.message?.from?.first_name;
          const lastName = body.message?.from?.last_name;
          const messageThreadId = body.message?.message_thread_id;
          const conversationId = messageThreadId 
            ? `telegram_${chatId}_thread_${messageThreadId}`
            : `telegram_${chatId}`;
          
          // CHECK FOR /start COMMAND - Return intro message immediately (no LLM call)
          if (userMessage.trim() === '/start') {
            console.log('Detected /start command - sending intro message');
            
            // Get community agent configuration for intro message
            const { data: communityData } = await supabase
              .from('communities')
              .select('agent_intro_message, agent_name, name')
              .eq('id', communityId)
              .single();
            
            const userName = firstName 
              ? `${firstName}${lastName ? ' ' + lastName : ''}`
              : telegramUsername || 'there';
            
            const agentName = communityData?.agent_name || 'Assistant';
            const communityName = communityData?.name || 'our community';
            
            // Build intro message from template (supports placeholders)
            const templateRaw = (communityData?.agent_intro_message || 
              `Hi {first_name}, I'm the {agent_name} bot. Ask me anything!`).trim();

            const vars = {
              first_name: firstName || (telegramUsername || 'there'),
              last_name: lastName || '',
              full_name: userName,
              username: telegramUsername || '',
              community_name: communityName,
              agent_name: agentName,
            } as const;

            const introMessage = templateRaw
              .replace(/\{first_name\}/gi, vars.first_name)
              .replace(/\{last_name\}/gi, vars.last_name)
              .replace(/\{full_name\}/gi, vars.full_name)
              .replace(/\{username\}/gi, vars.username ? `@${vars.username}` : vars.first_name)
              .replace(/\{community_name\}/gi, vars.community_name)
              .replace(/\{agent_name\}/gi, vars.agent_name);
            
            const botToken = await getBotToken(supabase, communityId);
            if (!botToken) {
              console.error('No Telegram bot token configured for community:', communityId);
              return new Response(JSON.stringify({ ok: true, message: 'Bot token not configured' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
              });
            }
            
            // Find or create user for /start command
            const startUserId = await findOrCreateUser(
              supabase,
              botToken,
              telegramUserId,
              telegramUsername,
              firstName,
              lastName
            );
            
            // Log the /start user message
            await supabase
              .from('messages')
              .insert({
                content: '/start',
                chat_type: 'telegram_bot',
                conversation_id: conversationId,
                community_id: communityId,
                sender_id: startUserId,
                sent_by: telegramUsername || firstName || 'telegram_user',
                metadata: {
                  telegram_chat_id: chatId,
                  telegram_user_id: telegramUserId,
                  telegram_message_id: body.message?.message_id,
                  chat_type_detail: chatType,
                  telegram_username: telegramUsername,
                  telegram_first_name: firstName,
                  telegram_last_name: lastName
                }
              });
            
            // Send the intro message
            const sendMessageResp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: introMessage,
                parse_mode: 'Markdown'
              })
            });
            
            const sendMessageData = await sendMessageResp.json();
            console.log('✅ Intro message sent:', sendMessageData);
            
            // Log the intro AI response message
            await supabase
              .from('messages')
              .insert({
                content: introMessage,
                chat_type: 'telegram_bot',
                conversation_id: conversationId,
                community_id: communityId,
                sender_id: null,
                sent_by: 'ai',
                metadata: {
                  telegram_chat_id: chatId,
                  chat_type_detail: chatType,
                  is_intro_message: true,
                  telegram_chat_title: body.message?.chat?.title || null,
                  telegram_chat_username: body.message?.chat?.username || null
                }
              });
            
            return new Response(JSON.stringify({ 
              ok: true, 
              message: 'Start command processed',
              intro_sent: true
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            });
          }
          
          // Get bot token before creating/finding user
          const botToken = await getBotToken(supabase, communityId);
          if (!botToken) {
            console.error('No Telegram bot token configured for community:', communityId);
            return new Response(JSON.stringify({ ok: true, message: 'Bot token not configured' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            });
          }
          
          // Find or create user
        const userId = await findOrCreateUser(
          supabase,
          botToken,
          telegramUserId,
          telegramUsername,
          firstName,
          lastName
        );
          
          // Check if this is a profile claim verification code
          if (userMessage.startsWith('CLAIM-') || userMessage.startsWith('/start CLAIM-')) {
            const verificationCode = userMessage.replace('/start ', '').trim();
            
            console.log('🔐 Profile claim verification attempt:', { verificationCode, userId });
            
            // Look up the claim request
            const { data: claimRequest, error: claimError } = await supabase
              .from('profile_claim_requests')
              .select('*')
              .eq('verification_code', verificationCode)
              .eq('is_verified', false)
              .gt('expires_at', new Date().toISOString())
              .single();
            
            if (claimError || !claimRequest) {
              console.log('❌ Invalid or expired verification code');
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: '❌ Invalid or expired verification code. Please request a new one from the profile page.'
                })
              });
              return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
            }
            
            // Verify that the Telegram user matches the profile
            const { data: profileToVerify } = await supabase
              .from('users')
              .select('*')
              .eq('id', claimRequest.user_profile_id)
              .single();
            
            if (profileToVerify?.telegram_user_id && profileToVerify.telegram_user_id !== telegramUserId) {
              console.log('❌ Telegram user ID mismatch');
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: '❌ This profile is linked to a different Telegram account.'
                })
              });
              return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
            }
            
            // Update the user profile to claim it
            const { error: updateError } = await supabase
              .from('users')
              .update({
                auth_user_id: claimRequest.auth_user_id,
                is_claimed: true,
                telegram_user_id: telegramUserId
              })
              .eq('id', claimRequest.user_profile_id);
            
            if (updateError) {
              console.error('❌ Error claiming profile:', updateError);
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: '❌ Error claiming profile. Please try again later.'
                })
              });
              return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
            }
            
            // Mark the claim request as verified
            await supabase
              .from('profile_claim_requests')
              .update({
                is_verified: true,
                verified_at: new Date().toISOString()
              })
              .eq('id', claimRequest.id);
            
            console.log('✅ Profile claimed successfully');
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: `✅ Success! Your profile has been claimed and verified. You can now manage your profile from the web dashboard.`
              })
            });
            
            return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
          }
          
          // Fetch conversation history BEFORE storing new message (sliding window: last 7 messages)
          const { data: conversationHistory } = await supabase
            .from('messages')
            .select('content, sent_by')
            .eq('conversation_id', conversationId)
            .eq('community_id', communityId)
            .order('created_at', { ascending: false })
            .limit(7);
          
          // Check if this is a new user (first message in conversation)
          const isNewUser = !conversationHistory || conversationHistory.length === 0;

          // For supergroups with threads, extract the thread name
          let threadName: string | null = null;
          if (chatType === 'supergroup' && messageThreadId) {
            // First try to get it from reply_to_message (most reliable)
            if (body.message?.reply_to_message?.forum_topic_created?.name) {
              threadName = body.message.reply_to_message.forum_topic_created.name;
              console.log('📍 Thread name from forum_topic_created:', threadName);
            } else if (body.message?.is_topic_message) {
              // If not in current message, check conversation history for the thread name
              const threadMessages = conversationHistory?.filter(
                (msg: any) => msg.metadata && typeof msg.metadata === 'object' && 'telegram_topic_name' in msg.metadata
              );
              if (threadMessages && threadMessages.length > 0) {
                const firstMsg = threadMessages[0] as any;
                threadName = firstMsg.metadata?.telegram_topic_name;
                console.log('📍 Thread name from history:', threadName);
              } else {
                // Last resort: mark for later enrichment
                threadName = `Thread ${messageThreadId}`;
                console.log('📍 Thread name unknown, using placeholder');
              }
            }
          }

          // Store incoming user message with proper sender_id
          const { data: insertedMessage, error: insertUserMsgError } = await supabase
            .from('messages')
            .insert({
              content: userMessage,
              chat_type: 'telegram_bot',
              conversation_id: conversationId,
              community_id: communityId,
              sender_id: userId, // NOW PROPERLY LINKED!
              sent_by: telegramUsername || firstName || 'telegram_user',
              topic_name: threadName, // Set thread name if we have it
              metadata: {
                telegram_chat_id: chatId,
                telegram_user_id: telegramUserId,
                telegram_message_id: body.message?.message_id,
                telegram_message_thread_id: messageThreadId,
                telegram_topic_name: threadName, // Store in metadata too
                chat_type_detail: chatType,
                telegram_username: telegramUsername,
                telegram_first_name: firstName,
                telegram_last_name: lastName,
                telegram_chat_title: body.message?.chat?.title || null, // Store group/supergroup title
                telegram_chat_username: body.message?.chat?.username || null
              }
            })
            .select()
            .single();
          
          if (insertUserMsgError) {
            console.error('Error storing user message:', insertUserMsgError);
          } else {
            console.log('✅ Stored message with thread name:', threadName);
          }

          // Check for auto-intro generation if this is a supergroup with topics
          if (chatType === 'supergroup' && messageThreadId && insertedMessage && threadName) {
            // Check if auto-intro generation is enabled and this is an intros thread
            const autoIntroConfig = workflowStatus.configuration?.auto_intro_generation;
            if (autoIntroConfig?.enabled) {
              const introThreadNames = autoIntroConfig.thread_names || ['intros', 'introductions', 'introduce yourself'];
              const isIntroThread = introThreadNames.some(name => 
                threadName?.toLowerCase().includes(name.toLowerCase())
              );
              
              if (isIntroThread && userMessage.length > 50) {
                console.log('🎯 Auto-generating intro for message in thread:', threadName);
                
                // Call generate-intro edge function
                try {
                  const introResponse = await fetch(
                    `${supabaseUrl}/functions/v1/generate-intro`,
                    {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        conversationId: conversationId,
                        communityId: communityId,
                        singleMessage: userMessage // Generate intro from this single message
                      })
                    }
                  );
                  
                  if (introResponse.ok) {
                    const introData = await introResponse.json();
                    const generatedIntro = introData.intro;
                    
                    // Save as memory
                    const { error: memoryError } = await supabase
                      .from('memories')
                      .insert({
                        community_id: communityId,
                        content: generatedIntro,
                        tags: ['intro', 'auto-generated', 'telegram'],
                        created_by: userId,
                        metadata: {
                          source: 'telegram_auto_intro',
                          thread_name: threadName,
                          telegram_username: telegramUsername,
                          telegram_user_id: telegramUserId,
                          message_id: insertedMessage.id
                        }
                      });
                    
                    if (memoryError) {
                      console.error('❌ Error saving auto-generated intro:', memoryError);
                    } else {
                      console.log('✅ Auto-generated intro saved to memories');
                    }
                  } else {
                    console.error('❌ Error generating intro:', await introResponse.text());
                  }
                } catch (introError) {
                  console.error('❌ Error in auto-intro generation:', introError);
                }
              }
            }
          }

          // Get bot info to check for mentions in groups
          let botUsername: string | undefined;
          let botUserId: number | undefined;
          if (chatType === 'group' || chatType === 'supergroup') {
            try {
              const botInfoResp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
              const botInfoData = await botInfoResp.json();
              botUsername = botInfoData.result?.username;
              botUserId = botInfoData.result?.id;
            } catch (err) {
              console.error('Error fetching bot info:', err);
            }
          }

          // Check if this message is a reply to a bot message
          const isReplyToBotMessage = body.message?.reply_to_message?.from?.id === botUserId;

          // FOR GROUPS/SUPERGROUPS: Only respond if bot is mentioned, it's a command, or replying to bot
          if ((chatType === 'group' || chatType === 'supergroup') && 
              !isBotMentioned(body.message, botUsername) && 
              !isReplyToBotMessage) {
            console.log(`Bot not mentioned and not replying to bot in ${chatType}, skipping AI response`);
            return new Response(JSON.stringify({ 
              ok: true, 
              message: 'Bot not mentioned in group',
              skipped: true 
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            });
          }
          
          if (isReplyToBotMessage) {
            console.log('✅ Message is a reply to bot message, responding in group');
          }
          
          // Send typing indicator immediately
          fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              action: 'typing'
            })
          }).catch(err => console.log('Error sending typing indicator:', err));

          // CHECK IF AGENT MODE IS ENABLED (any agent tool enabled)
          const hasAgentTools = workflowStatus.configuration?.agent_tools;
          const agentToolsEnabled = hasAgentTools && (
            hasAgentTools.web_search ||
            hasAgentTools.search_memory ||
            hasAgentTools.search_chat_history ||
            hasAgentTools.save_memory ||
            hasAgentTools.search_profiles
          );

          if (agentToolsEnabled) {
            console.log('🤖 Agent mode enabled - calling telegram-agent function');
            
            // Get community agent configuration for system prompt
            const { data: communityData } = await supabase
              .from('communities')
              .select('agent_instructions, agent_name')
              .eq('id', communityId)
              .single();

            const userName = firstName 
              ? `${firstName}${lastName ? ' ' + lastName : ''}`
              : telegramUsername || 'User';
            const agentName = communityData?.agent_name || 'Assistant';
            
            const systemPrompt = `You are an AI Agent named ${agentName}.
Current time: ${new Date().toISOString()}
User: ${userName}${telegramUsername ? ` (@${telegramUsername})` : ''}
Chat type: ${chatType === 'private' ? 'private DM' : `${chatType} chat`}

CRITICAL FORMATTING RULES - YOU MUST FOLLOW THESE EXACTLY:
- DO NOT use asterisks (*) for bold or italic text
- DO NOT use underscores (_) for italic text  
- DO NOT use markdown formatting of any kind
- DO NOT use special characters for emphasis
- Write in plain text only with line breaks for readability
- If you need emphasis, rewrite the sentence to make it naturally stand out
- These are Telegram messages - formatting will break and look bad to users

IMPORTANT: Keep responses under 4000 characters due to Telegram's message limit.

When asked about your capabilities or tools, describe them in simple, friendly terms:
- I can search the web for current information and news
- I can remember and recall community knowledge
- I can look through recent conversations to find information
- I can save important information to remember for later
- I can search community member profiles to find people with specific skills or interests

${communityData?.agent_instructions || 'Be helpful, friendly, and concise.'}`;

            // Build conversation history
            const conversationMessages = conversationHistory && conversationHistory.length > 0
              ? conversationHistory.reverse().map(msg => ({
                  role: msg.sent_by === 'ai' ? 'assistant' : 'user',
                  content: msg.content
                }))
              : [];

            // Call telegram-agent function
            const agentResponse = await fetch(
              `${supabaseUrl}/functions/v1/telegram-agent`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  userMessage,
                  conversationHistory: conversationMessages,
                  communityId,
                  userId,
                  systemPrompt,
                  telegramChatId: chatId,
                  botToken,
                  enabledTools: hasAgentTools
                })
              }
            );

            if (!agentResponse.ok) {
              const errorText = await agentResponse.text();
              console.error('❌ Agent function error:', agentResponse.status, errorText);
              throw new Error(`Agent function failed: ${agentResponse.status}`);
            }

            const agentData = await agentResponse.json();
            const aiReplyText = agentData.response;
            const tokensUsed = agentData.tokensUsed || 0;
            const modelUsed = agentData.model || 'google/gemini-2.5-flash';

            // Send final AI response to Telegram with error handling
            let sendMessageData: any;
            let truncatedReply = aiReplyText.length > 4096 ? aiReplyText.substring(0, 4093) + '...' : aiReplyText;
            
            try {
              // For forum chats, only include message_thread_id if it's from the current message
              // For replies to bot messages in non-forum groups, don't include thread_id
              const shouldIncludeThreadId = messageThreadId && 
                (body.message?.is_topic_message || body.message?.message_thread_id);
              
              // Send as plain text to avoid markdown parsing issues
              const sendMessageResp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: truncatedReply,
                  ...(shouldIncludeThreadId && { message_thread_id: messageThreadId })
                })
              });

              sendMessageData = await sendMessageResp.json();
              console.log('✅ Agent response sent to Telegram:', sendMessageData);
            } catch (sendError) {
              console.error('❌ Error sending message to Telegram:', sendError);
              
              // Try to notify user about the error
              try {
                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: '⚠️ Sorry, I encountered an error sending my response. Please try again.',
                    ...(messageThreadId && { message_thread_id: messageThreadId })
                  })
                });
              } catch (notifyError) {
                console.error('❌ Could not notify user about error:', notifyError);
              }
              
              throw sendError;
            }

            // Store AI response in messages
            await supabase
              .from('messages')
              .insert({
                content: aiReplyText,
                chat_type: 'telegram_bot',
                conversation_id: conversationId,
                community_id: communityId,
                sender_id: null,
                sent_by: 'ai',
                topic_name: threadName,
                metadata: {
                  telegram_chat_id: chatId,
                  chat_type_detail: chatType,
                  agent_mode: true,
                  tools_used: agentData.toolsUsed || [],
                  iterations: agentData.iterations || 0,
                  telegram_chat_title: body.message?.chat?.title || null,
                  telegram_chat_username: body.message?.chat?.username || null
                }
              });

            // Log analytics
            const responseTime = Date.now() - (insertedMessage?.created_at ? new Date(insertedMessage.created_at).getTime() : Date.now());
            await supabase.from('ai_chat_sessions').insert({
              community_id: communityId,
              user_id: userId,
              chat_type: 'telegram',
              model_used: modelUsed,
              tokens_used: tokensUsed,
              cost_usd: 0,
              message_count: conversationMessages.length + 2,
              metadata: {
                response_time_ms: responseTime,
                chat_type_detail: chatType,
                agent_mode: true,
                tools_used: agentData.toolsUsed || [],
                iterations: agentData.iterations || 0
              }
            });

            return new Response(JSON.stringify({ 
              ok: true, 
              agent_mode: true,
              tools_used: agentData.toolsUsed,
              iterations: agentData.iterations
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            });
          }

          {
            // STANDARD MODE (No agent tools) - Use direct OpenAI integration
            console.log('💬 Standard mode - using direct OpenAI integration');
            
            // Get community agent configuration
            const { data: communityData } = await supabase
              .from('communities')
              .select('agent_instructions, agent_name, agent_model, agent_max_tokens, agent_temperature, agent_intro_message')
              .eq('id', communityId)
              .single();

            // Fetch ALL community memories/knowledge with timestamps and IDs
            const { data: memories } = await supabase
              .from('memories')
              .select('id, content, created_at')
              .eq('community_id', communityId)
              .order('created_at', { ascending: false });

            // Build enhanced system prompt with context
            const currentTime = new Date().toISOString();
            const chatTypeLabel = chatType === 'private' ? 'private DM' : `${chatType} chat`;
            const userName = firstName 
              ? `${firstName}${lastName ? ' ' + lastName : ''}`
              : telegramUsername || 'User';
            const agentName = communityData?.agent_name || 'Assistant';
            
            let systemPrompt = `Current time: ${currentTime}
Chat type: ${chatTypeLabel}
User: ${userName}${telegramUsername ? ` (@${telegramUsername})` : ''}
Community: ${agentName}

CRITICAL FORMATTING RULES - YOU MUST FOLLOW THESE EXACTLY:
- DO NOT use asterisks (*) for bold or italic text
- DO NOT use underscores (_) for italic text
- DO NOT use markdown formatting of any kind
- DO NOT use special characters for emphasis
- Write in plain text only with line breaks for readability
- If you need emphasis, rewrite the sentence to make it naturally stand out
- These are Telegram messages - formatting will break and look bad to users

IMPORTANT: Keep responses under 4000 characters due to Telegram's message limit. Be concise and direct.

When asked about your capabilities or tools, describe them in simple, friendly terms:
- I can search the web for current information and news
- I can remember and recall community knowledge
- I can look through recent conversations to find information
- I can save important information to remember for later
- I can search community member profiles to find people with specific skills or interests

${communityData?.agent_instructions || 'You are a helpful community assistant.'}`;
            
            // Add memories in n8n format (timestamp | content | id)
            if (memories && memories.length > 0) {
              const memoriesContext = memories
                .map(m => `${m.created_at} | ${m.content} | ${m.id}`)
                .join('\n');
              systemPrompt += `\n\n=== Community Memory ===\n${memoriesContext}`;
            }

            // Build conversation history for OpenAI (reverse to chronological order for sliding window)
            const conversationMessages = conversationHistory && conversationHistory.length > 0
              ? conversationHistory.reverse().map(msg => ({
                  role: msg.sent_by === 'ai' ? 'assistant' : 'user',
                  content: msg.content
                }))
              : [];
            
            // Call OpenAI for AI response
            const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
            if (!openaiApiKey) {
              console.error('OpenAI API key not configured');
              throw new Error('AI service not configured');
            }

            const model = communityData?.agent_model || 'gpt-5-mini-2025-08-07';
            const isLegacyModel = model.includes('gpt-4o') || model.includes('gpt-3.5');
            
            // Build request body based on model type
            const requestBody: any = {
              model,
              messages: [
                {
                  role: 'system',
                  content: systemPrompt
                },
                ...conversationMessages, // Already limited to 7 messages by sliding window
                {
                  role: 'user',
                  content: userMessage
                }
              ]
            };

            // Add search_chat_history tool if enabled
            const searchHistoryEnabled = workflowStatus.configuration?.agent_tools?.search_chat_history;
            if (searchHistoryEnabled) {
              requestBody.tools = [
                {
                  type: "function",
                  function: {
                    name: "search_chat_history",
                    description: "Search recent community messages from the last N days to find relevant context or information.",
                    parameters: {
                      type: "object",
                      properties: {
                        days_back: {
                          type: "integer",
                          description: "Number of days to search back (default 7, max 30)",
                          minimum: 1,
                          maximum: 30
                        }
                      },
                      required: []
                    }
                  }
                }
              ];
              requestBody.tool_choice = "auto";
            }

            // Use correct token parameter based on model
            if (isLegacyModel) {
              requestBody.max_tokens = communityData?.agent_max_tokens || 2000;
              requestBody.temperature = communityData?.agent_temperature || 0.7;
            } else {
              requestBody.max_completion_tokens = communityData?.agent_max_tokens || 4000;
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
              const errorText = await aiResponse.text();
              console.error('❌ OpenAI API error:', aiResponse.status, errorText);
              throw new Error(`OpenAI API failed: ${aiResponse.status} - ${errorText}`);
            }

            const aiData = await aiResponse.json();
            console.log('✅ OpenAI response received:', {
              hasChoices: !!aiData.choices,
              choicesLength: aiData.choices?.length,
              hasContent: !!aiData.choices?.[0]?.message?.content,
              hasToolCalls: !!aiData.choices?.[0]?.message?.tool_calls,
              model: aiData.model,
              usage: aiData.usage
            });
            
            // Check if AI wants to use the search_chat_history tool
            const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
            let finalReplyText = aiData.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
            
            if (toolCalls && toolCalls.length > 0) {
              const toolCall = toolCalls[0];
              if (toolCall.function.name === 'search_chat_history') {
                console.log('🔍 AI requested chat history search');
                
                // Send "searching..." indicator to Telegram
                await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    action: 'find_location'
                  })
                });
                
                // Parse tool arguments
                const args = JSON.parse(toolCall.function.arguments || '{}');
                const daysBack = Math.min(Math.max(args.days_back || 7, 1), 30);
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysBack);
                
                // Query messages table for recent community messages
                const { data: recentMessages, error: searchError } = await supabase
                  .from('messages')
                  .select(`
                    content,
                    sent_by,
                    created_at,
                    sender:sender_id (
                      name
                    )
                  `)
                  .eq('community_id', communityId)
                  .gte('created_at', cutoffDate.toISOString())
                  .order('created_at', { ascending: false })
                  .limit(30);
                
                if (searchError) {
                  console.error('❌ Error searching messages:', searchError);
                } else {
                  console.log(`✅ Found ${recentMessages?.length || 0} messages from last ${daysBack} days`);
                }
                
                // Format search results for AI
                const formatTimeAgo = (timestamp: string) => {
                  const now = Date.now();
                  const then = new Date(timestamp).getTime();
                  const diffMs = now - then;
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMs / 3600000);
                  const diffDays = Math.floor(diffMs / 86400000);
                  
                  if (diffMins < 60) return `${diffMins}m ago`;
                  if (diffHours < 24) return `${diffHours}h ago`;
                  return `${diffDays}d ago`;
                };
                
                const searchResults = recentMessages && recentMessages.length > 0
                  ? recentMessages.map((msg: any) => {
                      const senderName = msg.sender?.name || msg.sent_by || 'Unknown';
                      const timeAgo = formatTimeAgo(msg.created_at);
                      return `[${timeAgo}] ${senderName}: ${msg.content}`;
                    }).join('\n')
                  : 'No messages found in the specified time range.';
                
                // Send tool results back to OpenAI for final response
                const toolResponseBody: any = {
                  model,
                  messages: [
                    {
                      role: 'system',
                      content: systemPrompt
                    },
                    ...conversationMessages,
                    {
                      role: 'user',
                      content: userMessage
                    },
                    aiData.choices[0].message, // Include original AI response with tool call
                    {
                      role: 'tool',
                      tool_call_id: toolCall.id,
                      content: searchResults
                    }
                  ]
                };
                
                // Use correct token parameter based on model
                if (isLegacyModel) {
                  toolResponseBody.max_tokens = communityData?.agent_max_tokens || 2000;
                  toolResponseBody.temperature = communityData?.agent_temperature || 0.7;
                } else {
                  toolResponseBody.max_completion_tokens = communityData?.agent_max_tokens || 4000;
                }
                
                // Call OpenAI again with tool results
                const toolAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(toolResponseBody),
                });
                
                if (!toolAiResponse.ok) {
                  console.error('❌ OpenAI tool response error:', await toolAiResponse.text());
                } else {
                  const toolAiData = await toolAiResponse.json();
                  finalReplyText = toolAiData.choices?.[0]?.message?.content || finalReplyText;
                  console.log('✅ AI synthesized response with search results');
                }
              }
            }
            
            if (!aiData.choices?.[0]?.message?.content && !toolCalls) {
              console.error('⚠️ No content in AI response:', JSON.stringify(aiData));
            }
            const responseTime = Date.now() - startTime;
            const replyText = finalReplyText;

            // Store AI response message (no sender_id for AI messages)
            const { error: insertAiMsgError } = await supabase
              .from('messages')
              .insert({
                content: replyText,
                chat_type: 'telegram_bot',
                conversation_id: conversationId,
                community_id: communityId,
                sender_id: null, // AI messages don't have a sender_id
                sent_by: 'ai',
                metadata: {
                  telegram_chat_id: chatId,
                  model_used: model,
                  response_time_ms: responseTime,
                  chat_type_detail: chatType,
                  telegram_chat_title: body.message?.chat?.title || null,
                  telegram_chat_username: body.message?.chat?.username || null,
                  // 🔍 Lightweight context reference for debugging
                  ai_context: {
                    memory_ids: memories?.map(m => m.id) || [],
                    context_message_count: conversationMessages.length,
                    model: model,
                    agent_instructions: communityData?.agent_instructions?.slice(0, 100) + '...' || null // First 100 chars only
                  }
                }
              });
            
            if (insertAiMsgError) {
              console.error('Error storing AI response:', insertAiMsgError);
            }

            // Truncate message if it exceeds Telegram's 4096 character limit
            let truncatedReply = replyText;
            if (replyText.length > 4096) {
              console.log(`⚠️ Message too long (${replyText.length} chars), truncating to 4096`);
              truncatedReply = replyText.substring(0, 4090) + '...';
            }

            // 🚀 SEND TO TELEGRAM IMMEDIATELY (don't wait for analytics)
            const telegramPromise = fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: truncatedReply,
                disable_web_page_preview: true,
              }),
            });

            // 📊 DO ANALYTICS IN BACKGROUND (non-blocking)
            const analyticsTask = async () => {
              try {
                const tokensUsed = aiData.usage?.total_tokens || 0;

                console.log(`📊 Analytics: ${tokensUsed} tokens, ${responseTime}ms, model: ${model}`);

                // Insert analytics record
                await supabase
                  .from('ai_chat_sessions')
                  .insert({
                    community_id: communityId,
                    chat_type: 'telegram_bot',
                    model_used: model,
                    tokens_used: tokensUsed,
                    message_count: 1,
                    metadata: {
                      response_time_ms: responseTime,
                      telegram_chat_id: chatId,
                      telegram_user_id: body.message?.from?.id,
                      chat_type_detail: chatType
                    }
                  });
              } catch (err) {
                console.error('❌ Analytics error:', err);
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