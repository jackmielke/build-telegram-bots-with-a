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
    const { userId, communityId, bio } = await req.json();

    if (!userId || !communityId || typeof bio !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, communityId, bio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Client bound to caller's JWT (for authorization checks under RLS)
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Admin client to perform the privileged update if authorized
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Ensure caller is authenticated
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authUserId = authData.user.id;

    // Authorization: must be community admin OR super admin
    // 1) Check community admin
    const { data: isAdminResult, error: adminCheckError } = await authClient.rpc('is_community_admin', {
      community_id_param: communityId,
      user_auth_id: authUserId,
    });

    if (adminCheckError) {
      console.error('is_community_admin RPC error:', adminCheckError);
    }

    let authorized = !!isAdminResult;

    // 2) If not community admin, check super admin role
    if (!authorized) {
      // Get internal users.id for this auth user
      const { data: internalIdData, error: internalIdErr } = await authClient.rpc('get_user_id_from_auth', {
        auth_user_id: authUserId,
      });

      if (internalIdErr) {
        console.error('get_user_id_from_auth RPC error:', internalIdErr);
      }

      if (internalIdData) {
        const { data: hasRoleRes, error: hasRoleErr } = await authClient.rpc('has_role', {
          _user_id: internalIdData,
          _role: 'admin',
        });
        if (hasRoleErr) {
          console.error('has_role RPC error:', hasRoleErr);
        }
        authorized = !!hasRoleRes;
      }
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform the privileged update
    const { error: updateError } = await adminClient
      .from('users')
      .update({ bio })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating bio:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update bio', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in set-user-bio function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});