import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getBotToken(supabase: any, communityId: string): Promise<string | null> {
  try {
    const { data: community } = await supabase
      .from('communities')
      .select('telegram_bot_token')
      .eq('id', communityId)
      .maybeSingle();
    if (community?.telegram_bot_token) return community.telegram_bot_token as string;
  } catch (e) {
    console.error('telegram-manage: error fetching community token', e);
  }

  try {
    const { data: bot } = await supabase
      .from('telegram_bots')
      .select('bot_token')
      .eq('community_id', communityId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (bot?.bot_token) return bot.bot_token as string;
  } catch (e) {
    console.error('telegram-manage: error fetching bot record', e);
  }

  const envToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (envToken) return envToken;
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, communityId } = await req.json();
    if (!communityId || !action) {
      return new Response(JSON.stringify({ error: 'Missing action or communityId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const botToken = await getBotToken(supabase, communityId);
    if (!botToken) {
      return new Response(JSON.stringify({ error: 'Bot token not found for this community.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'test_connection') {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const me = await resp.json();

      const webhookResp = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const webhookInfo = await webhookResp.json();

      const ok = me?.ok === true;
      return new Response(JSON.stringify({ ok, me, webhookInfo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reconnect_webhook') {
      // Delete any existing webhook
      await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, { method: 'POST' });

      const webhookUrl = `https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-webhook?community_id=${communityId}`;
      const setResp = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      });
      const setData = await setResp.json();
      if (!setData.ok) {
        return new Response(JSON.stringify({ error: setData.description || 'Failed to set webhook' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Persist webhook_url and set active
      await supabase
        .from('telegram_bots')
        .update({ webhook_url: webhookUrl, is_active: true })
        .eq('community_id', communityId);

      return new Response(JSON.stringify({ ok: true, message: 'Webhook reconnected' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete_webhook') {
      const del = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, { method: 'POST' });
      const delData = await del.json();
      if (!delData.ok) {
        return new Response(JSON.stringify({ error: delData.description || 'Failed to delete webhook' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Mark all bots for this community as inactive
      await supabase
        .from('telegram_bots')
        .update({ is_active: false })
        .eq('community_id', communityId);

      return new Response(JSON.stringify({ ok: true, message: 'Webhook deleted, bot marked inactive' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_webhook_info') {
      const infoResp = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const info = await infoResp.json();
      return new Response(JSON.stringify({ ok: true, info }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('telegram-manage error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
