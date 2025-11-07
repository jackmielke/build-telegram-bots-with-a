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

    // Get current time in UTC
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}:00`;
    
    console.log(`⏰ Current UTC time: ${currentTime}`);

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
      // Check if it's time to send for this community
      const { data: communityDetails } = await supabase
        .from('communities')
        .select('daily_message_time, timezone')
        .eq('id', community.community_id)
        .single();
      
      if (communityDetails?.daily_message_time) {
        const scheduledUTCTime = communityDetails.daily_message_time;
        
        // Parse scheduled time (HH:MM:SS format)
        const [schedHour, schedMin] = scheduledUTCTime.split(':').map(Number);
        const scheduledMinutes = schedHour * 60 + schedMin;
        
        // Current time in minutes
        const currentMinutes = currentHour * 60 + currentMinute;
        
        // Check if we're within ±7 minutes of the scheduled time (14 minute window)
        // This ensures we catch the message even if cron runs slightly off schedule
        const timeDiff = Math.abs(currentMinutes - scheduledMinutes);
        
        if (timeDiff > 7) {
          const timezone = communityDetails.timezone || 'UTC';
          console.log(`⏭️ Skipping ${community.community_name} (${timezone}) - scheduled for ${scheduledUTCTime} UTC, current time is ${currentTime} UTC (diff: ${timeDiff} min)`);
          continue;
        }
        
        console.log(`✅ Time match for ${community.community_name} - sending daily messages (within ${timeDiff} min window)`);
      }
      
      console.log(`\n📡 Processing community: ${community.community_name}`);

      // Get all active chat sessions for this community (filtered by proactive_outreach_enabled)
      const { data: sessions, error: sessionsError } = await supabase
        .from('telegram_chat_sessions')
        .select('telegram_chat_id, telegram_username, telegram_first_name, proactive_outreach_enabled')
        .eq('community_id', community.community_id)
        .eq('is_active', true)
        .eq('proactive_outreach_enabled', true); // Only send to users who opted in

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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
