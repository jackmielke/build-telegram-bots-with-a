import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BroadcastRequest {
  community_id: string;
  message: string;
  filter?: {
    include_opted_out?: boolean;
    min_message_count?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { community_id, message, filter = {} }: BroadcastRequest = await req.json();

    if (!community_id || !message) {
      return new Response(
        JSON.stringify({ error: 'community_id and message are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`📢 Starting broadcast for community: ${community_id}`);

    // Get community details and bot token
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('telegram_bot_token, name')
      .eq('id', community_id)
      .single();

    if (communityError || !community?.telegram_bot_token) {
      console.error('❌ Error fetching community:', communityError);
      throw new Error('Community not found or bot not configured');
    }

    // Build query for active chat sessions
    let query = supabase
      .from('telegram_chat_sessions')
      .select('telegram_chat_id, telegram_username, telegram_first_name, message_count, proactive_outreach_enabled')
      .eq('community_id', community_id)
      .eq('is_active', true);

    // Apply filters
    if (!filter.include_opted_out) {
      query = query.eq('proactive_outreach_enabled', true);
    }

    if (filter.min_message_count) {
      query = query.gte('message_count', filter.min_message_count);
    }

    const { data: sessions, error: sessionsError } = await query;

    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError);
      throw sessionsError;
    }

    if (!sessions || sessions.length === 0) {
      console.log('ℹ️ No eligible recipients found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No eligible recipients found',
          sent: 0,
          failed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`👥 Found ${sessions.length} eligible recipients`);

    let totalSent = 0;
    let totalFailed = 0;
    const failedRecipients = [];

    // Send message to each recipient
    for (const session of sessions) {
      try {
        const telegramUrl = `https://api.telegram.org/bot${community.telegram_bot_token}/sendMessage`;
        
        const response = await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: session.telegram_chat_id,
            text: message,
            parse_mode: 'Markdown'
          })
        });

        const result = await response.json();

        if (result.ok) {
          console.log(`✅ Sent to ${session.telegram_username || session.telegram_first_name || session.telegram_chat_id}`);
          totalSent++;
        } else {
          console.error(`❌ Failed to send to ${session.telegram_chat_id}:`, result);
          totalFailed++;
          failedRecipients.push({
            chat_id: session.telegram_chat_id,
            username: session.telegram_username,
            error: result.description
          });
        }
      } catch (error) {
        console.error(`❌ Error sending message to ${session.telegram_chat_id}:`, error);
        totalFailed++;
        failedRecipients.push({
          chat_id: session.telegram_chat_id,
          username: session.telegram_username,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`\n📊 Broadcast complete:`);
    console.log(`   ✅ Sent: ${totalSent}`);
    console.log(`   ❌ Failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: totalSent,
        failed: totalFailed,
        total_recipients: sessions.length,
        failed_recipients: failedRecipients
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Error in telegram-broadcast function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
