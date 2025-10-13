const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageContent, userName } = await req.json();

    if (!messageContent) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: messageContent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating bio for user:', userName);

    const systemPrompt = `You are a professional bio writer. Generate a concise bio based on the user's message. 

Guidelines:
- DO NOT use first person ("I", "my", "me") or third person ("he", "she", "they")
- DO NOT mention the person's name
- Simply list interests, passions, skills, and background directly
- Start with action words or descriptors (e.g., "Passionate about", "Big fan of", "Loves", "Into")
- Keep it conversational and authentic
- Maximum 3-4 sentences
- Extract key details like interests, occupation, hobbies, goals
- Make it engaging and natural

Example format:
"Passionate about open source and community building. Big fan of hiking, photography, and exploring new technologies. Currently working on AI-powered tools. Always eager to learn and collaborate."`;

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
          { 
            role: 'user', 
            content: `Generate a bio based on this message${userName ? ` from ${userName}` : ''}:\n\n${messageContent}` 
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate bio', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const generatedBio = data.choices?.[0]?.message?.content;

    if (!generatedBio) {
      return new Response(
        JSON.stringify({ error: 'No bio generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generated bio:', generatedBio);

    return new Response(
      JSON.stringify({ bio: generatedBio }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-bio function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
