import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { communityId } = await req.json();

    if (!communityId) {
      return new Response(
        JSON.stringify({ error: 'Missing communityId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting backfill for community ${communityId}`);

    // Calculate date 20 days ago
    const twentyDaysAgo = new Date();
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
    const cutoffDate = twentyDaysAgo.toISOString();

    console.log(`Only syncing users active since ${cutoffDate}`);

    // Find users who have recent activity (messages OR chat sessions) in the last 20 days
    const { data: recentMessages, error: messagesError } = await supabaseClient
      .from('messages')
      .select('sender_id')
      .eq('community_id', communityId)
      .gte('created_at', cutoffDate);

    const { data: recentSessions, error: sessionsError } = await supabaseClient
      .from('telegram_chat_sessions')
      .select('telegram_user_id')
      .eq('community_id', communityId)
      .gte('last_message_at', cutoffDate);

    if (messagesError || sessionsError) {
      console.error('Error querying recent activity:', messagesError || sessionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to query recent activity' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique user IDs from messages
    const activeUserIds = new Set(recentMessages?.map(m => m.sender_id) || []);
    
    // Get unique telegram user IDs from sessions
    const activeTelegramIds = new Set(recentSessions?.map(s => s.telegram_user_id) || []);

    console.log(`Found ${activeUserIds.size} users with recent messages, ${activeTelegramIds.size} with recent sessions`);

    // Fetch user details for these active users
    const { data: usersToAdd, error: queryError } = await supabaseClient
      .from('users')
      .select('id, telegram_user_id, telegram_username, name')
      .not('telegram_user_id', 'is', null)
      .or(`id.in.(${Array.from(activeUserIds).join(',')}),telegram_user_id.in.(${Array.from(activeTelegramIds).join(',')})`);

    if (queryError) {
      console.error('Error querying users:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to query users', details: queryError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${usersToAdd?.length || 0} active Telegram users to process`);

    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of usersToAdd || []) {
      try {
        // Check if they have messages in this community
        const { data: messages } = await supabaseClient
          .from('messages')
          .select('id')
          .eq('sender_id', user.id)
          .eq('community_id', communityId)
          .limit(1);

        // Or check if they have telegram_chat_sessions in this community
        const { data: sessions } = await supabaseClient
          .from('telegram_chat_sessions')
          .select('id')
          .eq('telegram_user_id', user.telegram_user_id)
          .eq('community_id', communityId)
          .limit(1);

        if (!messages?.length && !sessions?.length) {
          console.log(`User ${user.name} has no activity in this community, skipping`);
          skipped++;
          continue;
        }

        // Check if already a member
        const { data: existingMember } = await supabaseClient
          .from('community_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('community_id', communityId)
          .maybeSingle();

        if (existingMember) {
          console.log(`User ${user.name} already a member, skipping`);
          skipped++;
          continue;
        }

        // Add to community
        const { error: insertError } = await supabaseClient
          .from('community_members')
          .insert({
            user_id: user.id,
            community_id: communityId,
            role: 'member',
          });

        if (insertError) {
          console.error(`Error adding user ${user.name}:`, insertError);
          errors++;
        } else {
          console.log(`✓ Added user ${user.name} to community`);
          added++;
        }
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_users: usersToAdd?.length || 0,
          added,
          skipped,
          errors,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in backfill-community-members function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
