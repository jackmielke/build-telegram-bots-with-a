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

    const { message, communityId } = await req.json();

    if (!message || !communityId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: message and communityId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Provisioning Telegram user:', message.metadata?.telegram_username);

    // Extract user info from message metadata
    const telegramUserId = message.metadata?.telegram_user_id;
    const telegramUsername = message.metadata?.telegram_username;
    const telegramFirstName = message.metadata?.telegram_first_name;
    const telegramLastName = message.metadata?.telegram_last_name;
    const telegramPhotoUrl = message.metadata?.telegram_photo_url;

    if (!telegramUserId) {
      return new Response(
        JSON.stringify({ error: 'No Telegram user ID found in message metadata' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseClient
      .from('users')
      .select('id')
      .eq('telegram_user_id', telegramUserId)
      .single();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log('User already exists:', userId);
    } else {
      // Create new unclaimed user
      const name = [telegramFirstName, telegramLastName].filter(Boolean).join(' ') || telegramUsername || 'Telegram User';
      
      const { data: newUser, error: insertError } = await supabaseClient
        .from('users')
        .insert({
          telegram_user_id: telegramUserId,
          telegram_username: telegramUsername,
          telegram_photo_url: telegramPhotoUrl,
          name: name,
          username: telegramUsername,
          is_claimed: false,
          auth_user_id: null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.id;
      console.log('Created new user:', userId);
    }

    // Check if user is already a member of the community
    const { data: existingMember } = await supabaseClient
      .from('community_members')
      .select('id')
      .eq('user_id', userId)
      .eq('community_id', communityId)
      .single();

    if (!existingMember) {
      // Add user to community
      const { error: memberError } = await supabaseClient
        .from('community_members')
        .insert({
          user_id: userId,
          community_id: communityId,
          role: 'member',
        });

      if (memberError) {
        console.error('Error adding user to community:', memberError);
        return new Response(
          JSON.stringify({ error: 'Failed to add user to community', details: memberError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Added user to community');
    } else {
      console.log('User already a member of community');
    }

    // Fetch the complete user data
    const { data: userData, error: fetchError } = await supabaseClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching user data:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user data', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, user: userData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in provision-telegram-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
