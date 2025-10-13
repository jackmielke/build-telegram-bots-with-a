import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tool definitions (same as telegram-agent)
const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information, news, facts, or any information not in your knowledge base. Use this when you need up-to-date information or external knowledge.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to look up"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_memory",
      description: "Gather all memories from the community's knowledge base to provide context. Use this when you need to access saved community information, past facts, or stored knowledge.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_chat_history",
      description: "Search recent community chat messages to find relevant context or information from previous conversations.",
      parameters: {
        type: "object",
        properties: {
          days_back: {
            type: "integer",
            description: "Number of days to search back (default 7, max 30)",
            minimum: 1,
            maximum: 30
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save important information to the community's memory for future reference. Use this when users share important information that should be remembered.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The information to save"
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags to categorize this memory (e.g., ['event', 'announcement', 'faq'])"
          }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_member_profiles",
      description: "Fetch all community member profiles into context. Use this to get a comprehensive list of community members with their names, bios, interests, and skills. Best for general awareness of who's in the community.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Maximum number of profiles to return (default 20, max 50)",
            minimum: 1,
            maximum: 50
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "semantic_profile_search",
      description: "Advanced semantic search of user profiles using AI embeddings. Use this to find people based on conceptual similarity (e.g., 'looking for someone interested in AI' or 'find people who might collaborate on a design project'). Better for matching based on meaning rather than exact keywords.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The semantic search query to find users based on meaning and context"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "scrape_webpage",
      description: "Scrape and read the entire content of a specific webpage. Use this to extract detailed information from articles, documentation, blog posts, or any web page when you need the full content rather than just search results.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The full URL of the webpage to scrape (must start with http:// or https://)"
          }
        },
        required: ["url"]
      }
    }
  }
];

// Execute tool calls (same logic as telegram-agent)
async function executeTool(
  toolName: string,
  args: any,
  supabase: any,
  communityId: string,
  userId: string | null
): Promise<string> {
  console.log(`🔧 Executing tool: ${toolName}`, args);

  try {
    switch (toolName) {
      case "web_search": {
        console.log(`🌐 Web searching: "${args.query}"`);

        try {
          const tavilyKey = Deno.env.get("TAVILY_API_KEY");
          if (tavilyKey) {
            const tavilyResp = await fetch("https://api.tavily.com/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                api_key: tavilyKey,
                query: args.query,
                search_depth: "advanced",
                include_answer: true,
                max_results: 5
              })
            });

            if (tavilyResp.ok) {
              const data = await tavilyResp.json();
              const results: string[] = [];

              if (data.answer) {
                results.push(`Answer: ${data.answer}`);
              }

              if (Array.isArray(data.results) && data.results.length > 0) {
                const top = data.results
                  .slice(0, 3)
                  .map((r: any) => `• ${r.title || r.url} - ${r.url}`)
                  .join("\n");
                results.push(`Top sources:\n${top}`);
              }

              if (results.length > 0) {
                return results.join("\n\n");
              }
            }
          }
        } catch (e) {
          console.error("Tavily search failed, falling back to DuckDuckGo:", e);
        }

        const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_html=1`;
        const response = await fetch(searchUrl);
        const data = await response.json();

        const results: string[] = [];
        if (data.AbstractText) {
          results.push(`Summary: ${data.AbstractText}`);
        }
        if (data.RelatedTopics && data.RelatedTopics.length > 0) {
          const topics = data.RelatedTopics
            .filter((t: any) => t.Text)
            .slice(0, 5)
            .map((t: any) => `• ${t.Text}`)
            .join('\n');
          if (topics) {
            results.push(`Related Info:\n${topics}`);
          }
        }

        return results.length > 0
          ? results.join('\n\n')
          : `No results found for "${args.query}". Try a different search term.`;
      }

      case "search_memory": {
        console.log('🧠 Searching memories');
        
        const { data: memories } = await supabase
          .from('memories')
          .select('content, created_at, tags')
          .eq('community_id', communityId)
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (!memories || memories.length === 0) {
          return "No memories found in the community knowledge base.";
        }
        
        const formatted = memories
          .map((m: any) => {
            const date = new Date(m.created_at).toLocaleDateString();
            const tags = m.tags?.length > 0 ? ` [${m.tags.join(', ')}]` : '';
            return `• ${m.content} (${date})${tags}`;
          })
          .join('\n');
        
        return `Community Memories (${memories.length}):\n\n${formatted}`;
      }

      case "search_chat_history": {
        const daysBack = Math.min(args.days_back || 7, 30);
        console.log(`💬 Searching chat history: ${daysBack} days`);
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        
        const { data: messages } = await supabase
          .from('messages')
          .select('content, created_at, sent_by, metadata')
          .eq('community_id', communityId)
          .gte('created_at', cutoffDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(50);
        
        if (!messages || messages.length === 0) {
          return `No chat messages found in the last ${daysBack} days.`;
        }
        
        const formatted = messages
          .map((msg: any) => {
            const timestamp = new Date(msg.created_at).toLocaleString();
            const displayName = msg.metadata?.telegram_first_name || 
                               msg.metadata?.telegram_username || 
                               msg.sent_by || 
                               'User';
            return `[${timestamp}] ${displayName}: ${msg.content}`;
          })
          .join('\n');
        
        return `Recent Chat History (${messages.length} messages, ${daysBack} days):\n\n${formatted}`;
      }

      case "save_memory": {
        console.log(`💾 Saving memory: "${args.content.substring(0, 50)}..."`);
        
        const { error } = await supabase
          .from('memories')
          .insert({
            community_id: communityId,
            content: args.content,
            tags: args.tags || [],
            created_by: userId,
            metadata: {
              source: 'webhook_agent',
              saved_at: new Date().toISOString()
            }
          });
        
        if (error) {
          console.error('Error saving memory:', error);
          return `Failed to save memory: ${error.message}`;
        }
        
        return `✅ Memory saved successfully!`;
      }

      case "get_member_profiles": {
        console.log(`👥 Fetching community member profiles`);
        
        const limit = Math.min(args.limit || 20, 50);
        
        const { data: members } = await supabase
          .from('community_members')
          .select(`
            user:user_id (
              name,
              bio,
              interests_skills,
              headline,
              username,
              avatar_url
            )
          `)
          .eq('community_id', communityId)
          .limit(limit);
        
        if (!members || members.length === 0) {
          return "No community members found.";
        }
        
        const profiles = members
          .filter((m: any) => m.user)
          .map((m: any, idx: number) => {
            const user = m.user;
            const parts = [
              `${idx + 1}. ${user.name || 'Unknown'}`,
              user.headline ? `   Headline: ${user.headline}` : '',
              user.bio ? `   Bio: ${user.bio}` : '',
              user.interests_skills && user.interests_skills.length > 0 
                ? `   Interests/Skills: ${user.interests_skills.join(', ')}` 
                : ''
            ].filter(Boolean);
            return parts.join('\n');
          });
        
        return `Community Members (${profiles.length}):\n\n${profiles.join('\n\n')}`;
      }

      case "semantic_profile_search": {
        console.log(`🔍 Semantic profile search: "${args.query}"`);
        
        const { data: embeddingData, error: embeddingError } = await supabase.functions.invoke(
          'generate-embedding',
          {
            body: { text: args.query }
          }
        );
        
        if (embeddingError || !embeddingData?.embedding) {
          console.error('Error generating embedding:', embeddingError);
          return `Failed to generate search embedding. Please try again.`;
        }
        
        const { data: results, error: searchError } = await supabase.rpc(
          'semantic_search_users',
          {
            query_embedding: embeddingData.embedding,
            match_threshold: 0.7,
            match_count: 10
          }
        );
        
        if (searchError) {
          console.error('Error searching profiles:', searchError);
          return `Failed to search profiles: ${searchError.message}`;
        }
        
        if (!results || results.length === 0) {
          return `No profiles found matching "${args.query}" with sufficient similarity.`;
        }
        
        const formatted = results
          .map((r: any, idx: number) => {
            const parts = [
              `${idx + 1}. ${r.name || 'Unknown'} (similarity: ${(r.similarity * 100).toFixed(0)}%)`,
              r.bio ? `   Bio: ${r.bio.substring(0, 100)}${r.bio.length > 100 ? '...' : ''}` : '',
              r.interests_skills?.length > 0 ? `   Skills: ${r.interests_skills.slice(0, 3).join(', ')}` : ''
            ].filter(p => p);
            return parts.join('\n');
          })
          .join('\n\n');
        
        return `Found ${results.length} profile(s) matching "${args.query}":\n\n${formatted}`;
      }

      case "scrape_webpage": {
        console.log(`📄 Scraping webpage: "${args.url}"`);
        
        if (!args.url || (!args.url.startsWith('http://') && !args.url.startsWith('https://'))) {
          return `Invalid URL: "${args.url}". URL must start with http:// or https://`;
        }
        
        try {
          const response = await fetch(args.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; WebhookBot/1.0)'
            }
          });
          
          if (!response.ok) {
            return `Failed to fetch ${args.url}: ${response.status} ${response.statusText}`;
          }
          
          const html = await response.text();
          
          const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
          const title = titleMatch ? titleMatch[1].trim() : 'No title';
          
          let cleanHtml = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
          
          cleanHtml = cleanHtml.replace(/<[^>]+>/g, ' ');
          cleanHtml = cleanHtml.replace(/\s+/g, ' ').trim();
          
          const content = cleanHtml.substring(0, 2000);
          const truncatedContent = content.length === 2000 
            ? content + '... (truncated)'
            : content;
          
          return `📄 **${title}**\n\nURL: ${args.url}\n\n${truncatedContent}`;
          
        } catch (error) {
          console.error('Error scraping webpage:', error);
          return `Failed to scrape ${args.url}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { message, api_key, conversation_history } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Missing "message" field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!api_key) {
      return new Response(
        JSON.stringify({ error: 'Missing "api_key" field' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 Validating API key...');

    // Get community and workflow config
    const { data: community, error: communityError } = await supabase
      .from('communities')
      .select('id, name, agent_instructions, agent_name')
      .eq('webhook_api_key', api_key)
      .single();

    if (communityError || !community) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get webhook agent workflow config
    const { data: workflow } = await supabase
      .from('community_workflows')
      .select('configuration, is_enabled')
      .eq('community_id', community.id)
      .eq('workflow_type', 'webhook_agent')
      .single();

    if (!workflow || !workflow.is_enabled) {
      return new Response(
        JSON.stringify({ error: 'Webhook agent not enabled for this community' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Valid API key for community: ${community.name}`);

    const enabledTools = workflow.configuration?.agent_tools || {};
    
    // Filter tools based on enabled configuration
    const availableTools = AGENT_TOOLS.filter(tool => {
      const toolName = tool.function.name;
      return enabledTools[toolName] === true;
    });

    console.log('🛠️ Available tools:', availableTools.map(t => t.function.name));

    // Build system prompt
    const agentName = community.agent_name || 'Assistant';
    const systemPrompt = `You are ${agentName}, a helpful AI assistant for ${community.name}.
Current time: ${new Date().toISOString()}

${community.agent_instructions || 'Be helpful, friendly, and concise.'}`;

    // Build messages
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversation_history || []).map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // AI agent loop with tool calls
    let currentMessages = [...messages];
    let iterationCount = 0;
    const MAX_ITERATIONS = 5;
    let toolCalls: any[] = [];

    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      console.log(`🔄 Agent iteration ${iterationCount}`);

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: currentMessages,
          tools: availableTools.length > 0 ? availableTools : undefined
        })
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI API error:', aiResponse.status, errorText);
        throw new Error('AI service unavailable');
      }

      const aiData = await aiResponse.json();
      const choice = aiData.choices[0];
      
      // If AI wants to use tools
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        console.log(`🔧 AI requested ${choice.message.tool_calls.length} tool(s)`);
        
        currentMessages.push(choice.message);
        
        for (const toolCall of choice.message.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          console.log(`Executing: ${toolName}`);
          const toolResult = await executeTool(toolName, toolArgs, supabase, community.id, null);
          
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult
          });

          toolCalls.push({
            tool: toolName,
            arguments: toolArgs,
            result: toolResult.substring(0, 200) + (toolResult.length > 200 ? '...' : '')
          });
        }
        
        continue; // Loop again with tool results
      }
      
      // AI has final answer
      const responseText = choice.message.content;
      const tokensUsed = aiData.usage?.total_tokens || 0;

      console.log(`✅ Agent response complete (${tokensUsed} tokens, ${toolCalls.length} tools used)`);

      // Log analytics
      await supabase.from('ai_chat_sessions').insert({
        community_id: community.id,
        user_id: null,
        chat_type: 'webhook_agent',
        model_used: 'google/gemini-2.5-flash',
        tokens_used: tokensUsed,
        cost_usd: 0,
        message_count: 1,
        session_start_at: new Date().toISOString(),
        session_end_at: new Date().toISOString(),
        metadata: {
          source: 'webhook_agent_api',
          tool_calls: toolCalls
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          response: responseText,
          tool_calls: toolCalls,
          metadata: {
            community: community.name,
            model: 'google/gemini-2.5-flash',
            tokens_used: tokensUsed,
            tools_used: toolCalls.length
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    throw new Error('Max iterations reached');

  } catch (error) {
    console.error('❌ Webhook agent error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
