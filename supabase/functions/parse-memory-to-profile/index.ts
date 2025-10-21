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
    const { content } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Parsing memory content to profile data');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `You are a profile data extraction assistant. Extract profile information from the provided text and return it as structured JSON.

Extract these fields:
- name: The person's full name
- username: Their username/handle (if mentioned, otherwise generate from name)
- bio: Convert the text into a bio format. PRESERVE ALL THE ORIGINAL CONTENT AND DETAILS. Keep the same words and information. Only remove redundant mentions of their username or name if they appear within the text itself. Do not summarize or shorten - maintain the full length and all details.
- interests_skills: Array of their interests, skills, or areas of expertise
- headline: A short one-line headline about them

Return ONLY valid JSON with these exact field names. If information is missing, use null or empty array.`
          },
          {
            role: 'user',
            content: content
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_profile",
              description: "Extract profile information from text",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Full name" },
                  username: { type: "string", description: "Username or handle" },
                  bio: { type: "string", description: "Full bio preserving all original content" },
                  interests_skills: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Array of interests and skills"
                  },
                  headline: { type: "string", description: "One-line headline" }
                },
                required: ["name"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_profile" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in response');
    }

    const profileData = JSON.parse(toolCall.function.arguments);
    
    console.log('Extracted profile data:', profileData);

    return new Response(
      JSON.stringify({ profileData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in parse-memory-to-profile:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
