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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { communityId } = await req.json();
    
    if (!communityId) {
      return new Response(
        JSON.stringify({ error: 'communityId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[backfill-intros] Starting backfill for community:', communityId);

    // Find all intro messages from users without bios
    const { data: introMessages, error: queryError } = await supabaseClient
      .from('messages')
      .select(`
        id,
        content,
        sender_id,
        topic_name,
        created_at,
        users:sender_id (
          id,
          name,
          bio,
          telegram_username
        )
      `)
      .eq('community_id', communityId)
      .ilike('topic_name', '%intro%')
      .gte('content', ' '.repeat(50)) // At least 50 characters
      .order('created_at', { ascending: true });

    if (queryError) {
      console.error('[backfill-intros] Query error:', queryError);
      throw queryError;
    }

    console.log('[backfill-intros] Found', introMessages?.length || 0, 'intro messages');

    // Filter to only messages from users without bios
    const messagesToProcess = introMessages?.filter((msg: any) => {
      const user = Array.isArray(msg.users) ? msg.users[0] : msg.users;
      return user && (!user.bio || user.bio.trim() === '');
    }) || [];

    console.log('[backfill-intros] Will process', messagesToProcess.length, 'messages (users without bios)');

    let processed = 0;
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const message of messagesToProcess) {
      try {
        const user = Array.isArray(message.users) ? message.users[0] : message.users;
        
        console.log(`[backfill-intros] Processing message ${message.id} for user ${user.name} (${user.telegram_username})`);
        
        // Call generate-intro edge function
        const { data: introResult, error: introError } = await supabaseClient.functions.invoke(
          'generate-intro',
          {
            body: {
              singleMessage: message.content,
              userId: user.id,
              communityId: communityId
            }
          }
        );

        if (introError) {
          console.error(`[backfill-intros] Error generating intro for user ${user.id}:`, introError);
          failed++;
          errors.push(`${user.name}: ${introError.message}`);
        } else {
          console.log(`[backfill-intros] Successfully generated intro for user ${user.name}`);
          successful++;
        }

        processed++;

        // Rate limit: 50ms delay between calls
        await new Promise(resolve => setTimeout(resolve, 50));

      } catch (error) {
        console.error('[backfill-intros] Error processing message:', error);
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Message ${message.id}: ${errorMessage}`);
        processed++;
      }
    }

    console.log('[backfill-intros] Backfill complete:', { processed, successful, failed });

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          totalIntroMessages: introMessages?.length || 0,
          messagesToProcess: messagesToProcess.length,
          processed,
          successful,
          failed
        },
        errors: errors.length > 0 ? errors : undefined
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[backfill-intros] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
