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
    const { roadmapItemId, voteType, action } = await req.json();

    if (!roadmapItemId || !['upvote', 'downvote'].includes(voteType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current vote counts
    const { data: currentItem, error: fetchError } = await supabase
      .from('product_roadmap')
      .select('upvotes, downvotes')
      .eq('id', roadmapItemId)
      .single();

    if (fetchError || !currentItem) {
      return new Response(
        JSON.stringify({ error: 'Roadmap item not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update vote count based on action
    let updateData;
    if (action === 'remove') {
      updateData = voteType === 'upvote'
        ? { upvotes: Math.max(0, (currentItem.upvotes || 0) - 1) }
        : { downvotes: Math.max(0, (currentItem.downvotes || 0) - 1) };
    } else {
      updateData = voteType === 'upvote'
        ? { upvotes: (currentItem.upvotes || 0) + 1 }
        : { downvotes: (currentItem.downvotes || 0) + 1 };
    }

    const { data, error } = await supabase
      .from('product_roadmap')
      .update(updateData)
      .eq('id', roadmapItemId)
      .select()
      .single();

    if (error) {
      console.error('Error updating vote:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update vote' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        upvotes: data.upvotes,
        downvotes: data.downvotes 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in vote-roadmap function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});