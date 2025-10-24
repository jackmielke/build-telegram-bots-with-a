import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Community {
  community_id: string;
  community_name: string;
  telegram_bot_token: string;
  daily_message_content: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting daily message broadcast...');

    // Get all communities with daily messages enabled
    const { data: communities, error: communitiesError } = await supabase
      .rpc('get_communities_for_daily_message');

    if (communitiesError) {
      console.error('❌ Error fetching communities:', communitiesError);
      throw communitiesError;
    }

    if (!communities || communities.length === 0) {
      console.log('ℹ️ No communities with daily messages enabled');
      return new Response(
        JSON.stringify({ success: true, message: 'No communities to send messages to' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📨 Found ${communities.length} communities with daily messages enabled`);

    let totalSent = 0;
    let totalFailed = 0;

    // For each community, send messages to all active chat sessions
    for (const community of communities as Community[]) {
      console.log(`\n📡 Processing community: ${community.community_name}`);

      // Get all active chat sessions for this community
      const { data: sessions, error: sessionsError } = await supabase
        .from('telegram_chat_sessions')
        .select('telegram_chat_id, telegram_username, telegram_first_name')
        .eq('community_id', community.community_id)
        .eq('is_active', true);

      if (sessionsError) {
        console.error(`❌ Error fetching sessions for ${community.community_name}:`, sessionsError);
        totalFailed++;
        continue;
      }

      if (!sessions || sessions.length === 0) {
        console.log(`ℹ️ No active sessions for ${community.community_name}`);
        continue;
      }

      console.log(`👥 Found ${sessions.length} active chat sessions`);

      // Send message to each chat session
      for (const session of sessions) {
        try {
          const telegramUrl = `https://api.telegram.org/bot${community.telegram_bot_token}/sendMessage`;
          
          const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: session.telegram_chat_id,
              text: community.daily_message_content,
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
          }
        } catch (error) {
          console.error(`❌ Error sending message to ${session.telegram_chat_id}:`, error);
          totalFailed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`\n📊 Daily message broadcast complete:`);
    console.log(`   ✅ Sent: ${totalSent}`);
    console.log(`   ❌ Failed: ${totalFailed}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: totalSent,
        failed: totalFailed,
        communities: communities.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Error in telegram-daily-message function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
