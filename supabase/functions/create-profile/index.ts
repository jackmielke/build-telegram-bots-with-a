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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Client with the caller's JWT (RLS enforced)
    const authHeader = req.headers.get('Authorization');
    const authedClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Privileged client for the actual write
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { name, username, bio, interests_skills, headline } = body ?? {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(
        JSON.stringify({ error: 'Name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller is admin using RLS-safe client
    const { data: roles, error: rolesError } = await authedClient
      .from('user_roles')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (rolesError) {
      console.error('Role check error:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Unable to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = Array.isArray(roles) && roles.length > 0;
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize inputs
    const normalizedUsername = (typeof username === 'string' && username.trim())
      ? username.replace(/^@+/, '').trim()
      : null;

    const interests = Array.isArray(interests_skills)
      ? interests_skills.map((s: unknown) => typeof s === 'string' ? s.trim() : '').filter(Boolean)
      : null;

    console.log('Creating profile for:', name, 'username:', normalizedUsername);

    const { data: created, error: insertError } = await adminClient
      .from('users')
      .insert({
        name: name.trim(),
        username: normalizedUsername,
        bio: typeof bio === 'string' && bio.trim() ? bio.trim() : null,
        interests_skills: interests && interests.length ? interests : null,
        headline: typeof headline === 'string' && headline.trim() ? headline.trim() : null,
        is_claimed: false,
        auth_user_id: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating profile:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create profile', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ user: created }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-profile function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
