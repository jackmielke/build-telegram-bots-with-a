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
      description: "Search the community's saved memories and knowledge base for relevant information. Use this to recall past conversations, saved facts, or community information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What to search for in community memories"
          }
        },
        required: ["query"]
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
        console.log(`🧠 Searching memories for: "${args.query}"`);
        
        const { data: memories } = await supabase
          .from('memories')
          .select('content, created_at, tags')
          .eq('community_id', communityId)
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (!memories || memories.length === 0) {
          return "No memories found in the community knowledge base.";
        }
        
        // Simple keyword matching (you could enhance with vector search later)
        const queryLower = args.query.toLowerCase();
        const relevantMemories = memories.filter((m: any) => 
          m.content.toLowerCase().includes(queryLower) ||
          m.tags?.some((t: string) => t.toLowerCase().includes(queryLower))
        );
        
        if (relevantMemories.length === 0) {
          return `No memories found matching "${args.query}".`;
        }
        
        const formatted = relevantMemories
          .slice(0, 5)
          .map((m: any) => {
            const date = new Date(m.created_at).toLocaleDateString();
            const tags = m.tags?.length > 0 ? ` [${m.tags.join(', ')}]` : '';
            return `• ${m.content} (${date})${tags}`;
          })
          .join('\n');
        
        return `Found ${relevantMemories.length} relevant memories:\n${formatted}`;
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
      conversationHistory, 
      communityId,
      userId,
      systemPrompt,
      telegramChatId,
      botToken 
    } = await req.json();

    console.log('🤖 Agent request:', {
      userMessage: userMessage.substring(0, 50),
      historyLength: conversationHistory?.length || 0,
      communityId
    });

    // Build messages for AI
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...conversationHistory.map((msg: any) => ({
        role: msg.sent_by === 'ai' ? 'assistant' : 'user',
        content: msg.content
      })),
      {
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
          tools: AGENT_TOOLS,
          tool_choice: 'auto'
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
          
          // Send tool usage notification to Telegram (without markdown to avoid parse errors)
          const toolMessage = `🔧 Using tool: ${toolName}${args.query ? `\n🔍 Query: "${args.query}"` : ''}`;
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
