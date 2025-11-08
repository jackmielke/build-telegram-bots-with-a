import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const defaultStatuses = ['completed', 'in_progress', 'planned'];
    let statuses = defaultStatuses;

    try {
      if (req.method !== 'GET') {
        const body = await req.json();
        if (Array.isArray(body?.statuses) && body.statuses.length > 0) {
          statuses = body.statuses;
        }
      }
    } catch (_) {
      // ignore body parse errors and fall back to defaults
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('product_roadmap')
      .select('*')
      .in('status', statuses)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('public-roadmap: query error', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch roadmap' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ items: data ?? [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('public-roadmap: unhandled error', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
