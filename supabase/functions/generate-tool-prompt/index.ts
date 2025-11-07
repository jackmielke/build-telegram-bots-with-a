import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { toolDescription } = await req.json();
    
    if (!toolDescription || typeof toolDescription !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Tool description is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Generate comprehensive API specification prompt using AI
    const systemPrompt = `You are an expert API architect and developer advocate. When a user describes what they want a tool to do, you generate a comprehensive, copy-paste-ready prompt that they can take to ANY app builder, AI assistant, or development platform to create the exact API endpoint needed.

Your generated prompt should include:
1. Clear API specification (endpoint design, HTTP method, authentication)
2. Request format with example JSON
3. Response format with example JSON
4. Implementation guidance for common platforms (Lovable, Make.com, Zapier, custom server)
5. Security considerations
6. Testing instructions

Make the prompt extremely detailed but easy to follow. The user should be able to copy your entire response and paste it into another chat/platform to get a working API.`;

    const userPrompt = `Generate a comprehensive API implementation prompt for this tool:

"${toolDescription}"

Create a detailed prompt that someone can copy and paste into:
- Another AI assistant (like Claude, ChatGPT, Lovable)
- A no-code platform (Make.com, Zapier)
- Or use as a guide for manual implementation

The prompt should be self-contained and include all technical details needed to build this API endpoint.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway request failed: ${response.status}`);
    }

    const data = await response.json();
    const generatedPrompt = data.choices?.[0]?.message?.content;

    if (!generatedPrompt) {
      throw new Error('No prompt generated from AI');
    }

    // Also extract suggested API details using tool calling
    const extractionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'Extract structured API details from the tool description.' 
          },
          { 
            role: 'user', 
            content: `Extract API details for: ${toolDescription}` 
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_api_details',
            description: 'Extract suggested API structure details',
            parameters: {
              type: 'object',
              properties: {
                suggested_name: {
                  type: 'string',
                  description: 'Suggested tool name (lowercase, snake_case)'
                },
                suggested_parameters: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' }
                    }
                  },
                  description: 'Suggested parameters the API should accept'
                }
              },
              required: ['suggested_name', 'suggested_parameters']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'extract_api_details' } }
      }),
    });

    let suggestedDetails = null;
    if (extractionResponse.ok) {
      const extractionData = await extractionResponse.json();
      const toolCall = extractionData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          suggestedDetails = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error('Failed to parse suggested details:', e);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        generatedPrompt,
        suggestedDetails
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-tool-prompt:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
