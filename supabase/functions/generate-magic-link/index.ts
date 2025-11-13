import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateMagicLinkRequest {
  telegram_user_id: number;
  community_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { telegram_user_id, community_id }: GenerateMagicLinkRequest = await req.json();

    if (!telegram_user_id || !community_id) {
      return new Response(
        JSON.stringify({ error: 'Missing telegram_user_id or community_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the user by telegram_user_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, is_claimed')
      .eq('telegram_user_id', telegram_user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If already claimed, return message
    if (user.is_claimed) {
      return new Response(
        JSON.stringify({ 
          already_claimed: true,
          message: 'This profile is already claimed!'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a unique token (valid for 24 hours)
    const token = crypto.randomUUID();
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Store the magic link token
    const { error: insertError } = await supabase
      .from('magic_link_tokens')
      .insert({
        token,
        user_id: user.id,
        community_id,
        expires_at,
        used: false
      });

    if (insertError) {
      console.error('Error creating magic link token:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate magic link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate the magic link
    const magic_link = `https://bot-builder.app/claim?token=${token}`;

    return new Response(
      JSON.stringify({ 
        magic_link,
        expires_at 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-magic-link:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
