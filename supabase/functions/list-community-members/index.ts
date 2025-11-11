import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { communityId } = await req.json();
    if (!communityId) {
      return new Response(JSON.stringify({ error: "communityId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client bound to the caller for auth/membership checks
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map auth user to app user id
    const { data: viewerUser, error: viewerErr } = await supabaseUser
      .from("users")
      .select("id")
      .eq("auth_user_id", authData.user.id)
      .single();

    if (viewerErr || !viewerUser?.id) {
      return new Response(JSON.stringify({ error: "No linked user profile" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is a member of the community
    const { data: membership, error: membershipErr } = await supabaseUser
      .from("community_members")
      .select("id, role")
      .eq("community_id", communityId)
      .eq("user_id", viewerUser.id)
      .maybeSingle();

    if (membershipErr || !membership) {
      return new Response(JSON.stringify({ error: "Forbidden: not a community member" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for efficient server-side joins
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Fetch members
    const { data: membersRows, error: membersErr } = await supabaseAdmin
      .from("community_members")
      .select("id, role, joined_at, user_id")
      .eq("community_id", communityId)
      .order("joined_at", { ascending: true });

    if (membersErr) {
      console.error("membersErr", membersErr);
      return new Response(JSON.stringify({ error: membersErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = Array.from(new Set((membersRows || []).map((m: any) => m.user_id))).filter(Boolean);

    // 2) Fetch user details
    let usersMap = new Map<string, any>();
    if (userIds.length) {
      const { data: usersRows, error: usersErr } = await supabaseAdmin
        .from("users")
        .select("id, name, email, avatar_url, is_claimed, telegram_user_id")
        .in("id", userIds);
      if (usersErr) {
        console.error("usersErr", usersErr);
        return new Response(JSON.stringify({ error: usersErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      usersMap = new Map((usersRows || []).map((u: any) => [u.id, u]));
    }

    // 3) Fetch telegram chat sessions for DM eligibility
    const { data: sessionsRows, error: sessionsErr } = await supabaseAdmin
      .from("telegram_chat_sessions")
      .select("telegram_user_id, is_active, proactive_outreach_enabled")
      .eq("community_id", communityId);

    if (sessionsErr) {
      console.error("sessionsErr", sessionsErr);
    }

    const sessionsMap = new Map<number, any>(
      (sessionsRows || []).map((s: any) => [s.telegram_user_id, { is_active: s.is_active, proactive_outreach_enabled: s.proactive_outreach_enabled }])
    );

    const enriched = (membersRows || []).map((m: any) => {
      const u = usersMap.get(m.user_id) || null;
      const telegram_session = u?.telegram_user_id ? sessionsMap.get(u.telegram_user_id) || null : null;
      return {
        id: m.id,
        role: m.role,
        joined_at: m.joined_at,
        users: u,
        telegram_session,
      };
    });

    return new Response(JSON.stringify({ members: enriched }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("list-community-members error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
