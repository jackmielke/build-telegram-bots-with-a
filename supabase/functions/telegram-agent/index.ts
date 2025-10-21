import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tool definitions for the AI agent
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

// Execute tool calls
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

        // Prefer Tavily (if API key configured), fallback to DuckDuckGo Instant Answer API
        try {
          const tavilyKey = Deno.env.get("TAVILY_API_KEY");
          if (tavilyKey) {
            // Tavily is designed for AI agents and returns summaries + sources
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
              // If Tavily returned but with no content, fall through to DDG
            } else {
              console.warn("Tavily API returned non-OK status:", tavilyResp.status);
            }
          }
        } catch (e) {
          console.error("Tavily search failed, falling back to DuckDuckGo:", e);
        }

        // Fallback: DuckDuckGo Instant Answer (limited coverage for live events)
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
        console.log(`🧠 Gathering all memories into context`);
        
        const { data: memories } = await supabase
          .from('memories')
          .select('content, created_at, tags')
          .eq('community_id', communityId)
          .order('created_at', { ascending: false })
          .limit(200);
        
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
        
        return `Community Knowledge Base (${memories.length} memories):\n${formatted}`;
      }

      case "search_chat_history": {
        const daysBack = Math.min(Math.max(args.days_back || 7, 1), 30);
        console.log(`💬 Searching chat history: last ${daysBack} days`);
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        
        const { data: messages } = await supabase
          .from('messages')
          .select(`
            content,
            sent_by,
            created_at,
            sender:sender_id (name)
          `)
          .eq('community_id', communityId)
          .gte('created_at', cutoffDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(30);
        
        if (!messages || messages.length === 0) {
          return `No messages found in the last ${daysBack} days.`;
        }
        
        const formatted = messages
          .map((m: any) => {
            const timeAgo = getTimeAgo(m.created_at);
            const sender = m.sender?.name || m.sent_by || 'Someone';
            return `${timeAgo} | ${sender}: ${m.content.substring(0, 100)}`;
          })
          .join('\n');
        
        return `Found ${messages.length} recent messages:\n${formatted}`;
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
              source: 'telegram_agent',
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
        
        // Get community members with their profile data
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
        
        // Call the generate-embedding edge function to get the query embedding
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
        
        // Use the semantic_search_users database function
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
          return `No profiles found matching "${args.query}" with sufficient similarity. Try a different search term or use get_member_profiles to see all members.`;
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
        
        // Validate URL
        if (!args.url || (!args.url.startsWith('http://') && !args.url.startsWith('https://'))) {
          return `Invalid URL: "${args.url}". URL must start with http:// or https://`;
        }
        
        try {
          // Fetch the webpage
          const response = await fetch(args.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; TelegramBot/1.0)'
            }
          });
          
          if (!response.ok) {
            return `Failed to fetch ${args.url}: ${response.status} ${response.statusText}`;
          }
          
          const html = await response.text();
          
          // Extract title
          const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
          const title = titleMatch ? titleMatch[1].trim() : 'No title';
          
          // Remove script and style tags
          let cleanHtml = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
          
          // Remove HTML tags but keep spacing
          cleanHtml = cleanHtml
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/h[1-6]>/gi, '\n\n')
            .replace(/<li>/gi, '• ')
            .replace(/<\/li>/gi, '\n')
            .replace(/<[^>]+>/g, ' ');
          
          // Decode HTML entities
          cleanHtml = cleanHtml
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&mdash;/g, '—')
            .replace(/&ndash;/g, '–');
          
          // Clean up whitespace
          const lines = cleanHtml
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
          
          // Remove duplicates and join
          const uniqueLines = [...new Set(lines)];
          const content = uniqueLines.join('\n');
          
          // Limit content length (important for API token limits)
          const maxLength = 6000;
          const truncatedContent = content.length > maxLength 
            ? content.substring(0, maxLength) + '\n\n[Content truncated...]'
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

function getTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
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

    const { 
      userMessage, 
      imageUrl, // Add imageUrl parameter
      conversationHistory, 
      communityId,
      userId,
      systemPrompt,
      telegramChatId,
      botToken,
      enabledTools
    } = await req.json();

    console.log('🤖 Agent request:', {
      userMessage: userMessage.substring(0, 50),
      hasImage: !!imageUrl,
      historyLength: conversationHistory?.length || 0,
      communityId
    });

    // Filter tools based on enabled configuration
    const availableTools = AGENT_TOOLS.filter(tool => {
      const toolName = tool.function.name;
      // Map tool names to configuration keys
      const configKey = toolName; // web_search, search_memory, etc.
      return enabledTools && enabledTools[configKey] === true;
    });

    console.log('🛠️ Available tools:', availableTools.map(t => t.function.name));

    // Build messages for AI with vision support
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...conversationHistory.map((msg: any) => {
        // If message has an image, format it for vision
        if (msg.imageUrl) {
          return {
            role: msg.role,
            content: [
              { type: 'text', text: msg.content },
              { type: 'image_url', image_url: { url: msg.imageUrl } }
            ]
          };
        }
        // Text-only message
        return {
          role: msg.role,
          content: msg.content
        };
      }),
      // Current user message with optional image
      imageUrl ? {
        role: 'user',
        content: [
          { type: 'text', text: userMessage },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      } : {
        role: 'user',
        content: userMessage
      }
    ];

    // Initial AI call with tools
    let currentMessages = [...messages];
    let iterationCount = 0;
    const MAX_ITERATIONS = 5; // Prevent infinite loops
    let toolUsageMessages: string[] = [];

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
          // Only send tools that are enabled in configuration
          ...(availableTools.length > 0 ? { 
            tools: availableTools,
            tool_choice: 'auto'
          } : {}),
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('❌ AI API error:', aiResponse.status, errorText);
        throw new Error(`AI API failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const choice = aiData.choices[0];
      const message = choice.message;

      // Check if AI wants to use tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`🔧 AI requested ${message.tool_calls.length} tool(s)`);
        
        // Add AI's tool call request to conversation
        currentMessages.push(message);

        // Execute each tool and send status to Telegram
        for (const toolCall of message.tool_calls) {
          const toolName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments || '{}');
          
          // SECURITY CHECK: Verify tool is actually enabled
          if (!enabledTools || !enabledTools[toolName]) {
            console.error(`⚠️ Tool ${toolName} was called but is not enabled in configuration`);
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Error: Tool ${toolName} is not enabled. Available tools: ${Object.keys(enabledTools || {}).filter(k => enabledTools[k]).join(', ')}`
            });
            continue; // Skip this tool
          }
          
          // Create friendly user-facing messages for each tool
          let toolMessage = '';
          switch (toolName) {
            case 'web_search':
              toolMessage = args.query 
                ? `🌐 Searching the web for "${args.query}"...`
                : '🌐 Searching the web...';
              break;
            case 'search_memory':
              toolMessage = '🧠 Let me check what I remember...';
              break;
            case 'search_chat_history':
              const days = args.days_back || 7;
              toolMessage = `💬 Looking through the last ${days} days of messages...`;
              break;
            case 'save_memory':
              toolMessage = '💾 Saving this to my memory...';
              break;
            case 'get_member_profiles':
              toolMessage = "👥 Looking at everyone's profiles...";
              break;
            case 'semantic_profile_search':
              toolMessage = args.query
                ? `🔍 Searching for people like "${args.query}"...`
                : '🔍 Searching member profiles...';
              break;
            case 'scrape_webpage':
              toolMessage = args.url
                ? `📄 Reading webpage: ${args.url}...`
                : '📄 Reading webpage...';
              break;
            default:
              toolMessage = `🔧 Using tool: ${toolName}`;
          }
          
          toolUsageMessages.push(toolMessage);
          
          if (botToken && telegramChatId) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: telegramChatId,
                text: toolMessage
              })
            }).catch(err => console.log('Error sending tool notification:', err));
          }

          // Execute the tool with error handling
          let toolResult: string;
          try {
            toolResult = await executeTool(
              toolName,
              args,
              supabase,
              communityId,
              userId
            );
            console.log(`✅ Tool ${toolName} executed successfully`);
          } catch (toolError) {
            console.error(`❌ Error executing tool ${toolName}:`, toolError);
            toolResult = `Error executing ${toolName}: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`;
            
            // Notify user about tool error
            if (botToken && telegramChatId) {
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: telegramChatId,
                  text: `⚠️ Error using ${toolName}: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`
                })
              }).catch(err => console.log('Error sending error notification:', err));
            }
          }

          // Add tool result to conversation
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult
          });
        }
      } else {
        // AI has final response, no more tools needed
        const finalResponse = message.content || 'I apologize, but I could not generate a response.';
        
        console.log('✅ Agent completed:', {
          iterations: iterationCount,
          toolsUsed: toolUsageMessages.length,
          responseLength: finalResponse.length
        });

        return new Response(JSON.stringify({
          response: finalResponse,
          toolsUsed: toolUsageMessages,
          iterations: iterationCount,
          usage: aiData.usage
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Max iterations reached
    console.warn('⚠️ Max iterations reached');
    return new Response(JSON.stringify({
      response: 'I tried to help but needed too many steps. Can you rephrase your question?',
      toolsUsed: toolUsageMessages,
      iterations: iterationCount,
      maxReached: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Agent error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
