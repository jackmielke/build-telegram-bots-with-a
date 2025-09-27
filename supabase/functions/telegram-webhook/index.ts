import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WorkflowCheck {
  is_enabled: boolean;
  configuration: any;
}

// Circuit breaker function - checks if workflow is enabled
async function isWorkflowEnabled(
  supabase: any, 
  communityId: string, 
  workflowType: string
): Promise<WorkflowCheck | null> {
  try {
    const { data, error } = await supabase
      .from('community_workflows')
      .select('is_enabled, configuration')
      .eq('community_id', communityId)
      .eq('workflow_type', workflowType)
      .single();

    if (error) {
      console.error('Error checking workflow status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Circuit breaker error:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('Telegram webhook received:', body);

    // Extract community info from the webhook data
    // In a real implementation, you'd get this from bot registration
    const communityId = body.community_id || 'your-community-id-here';
    
    // CIRCUIT BREAKER: Check if telegram integration is enabled
    const workflowStatus = await isWorkflowEnabled(
      supabase, 
      communityId, 
      'telegram_integration'
    );

    if (!workflowStatus || !workflowStatus.is_enabled) {
      console.log('Telegram integration is disabled for community:', communityId);
      
      // Return success to Telegram but don't process the message
      return new Response(JSON.stringify({ 
        ok: true, 
        message: 'Workflow disabled' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log('Telegram integration is enabled, processing message...');
    
    // Only process if workflow is enabled
    if (body.message) {
      // Your existing telegram bot logic here
      console.log('Processing message:', body.message.text);
      
      // Example: Save message to database, generate AI response, etc.
      // This is where you'd put your actual telegram bot logic
      
      return new Response(JSON.stringify({ 
        ok: true,
        processed: true,
        workflow_enabled: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in telegram webhook:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});