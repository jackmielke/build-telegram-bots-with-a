# Submit Vibe Complete Implementation Flow

This diagram shows the complete flow after implementing system prompt instructions for the submit_vibe tool.

```mermaid
sequenceDiagram
    participant User as 👤 User
    participant TG as 📱 Telegram
    participant Webhook as 🔔 telegram-webhook
    participant Agent as 🤖 telegram-agent
    participant AI as 🧠 AI (Gemini)
    participant VibeAPI as ✨ submit-vibe API
    participant DB as 💾 Database

    User->>TG: Sends photo + "Rate my vibe!"
    TG->>Webhook: POST /telegram-webhook<br/>(photo + message)
    
    Note over Webhook: Downloads photo from Telegram<br/>Extracts firstName, username
    
    Webhook->>Webhook: Build system prompt with:<br/>- VIBE CHECK TOOL USAGE instructions<br/>- User context (${firstName}, @${telegramUsername})
    
    Webhook->>Agent: invoke telegram-agent<br/>(imageUrl, userMessage, systemPrompt, enabledTools)
    
    Agent->>Agent: Normalize model to allowed list<br/>(e.g., gpt-4o → gemini-2.5-flash)
    
    Agent->>AI: Chat completion request<br/>(system prompt + tools + image)
    
    Note over AI: Reads VIBE CHECK instructions:<br/>"When photo + vibe keywords,<br/>use submit_vibe tool"
    
    AI->>Agent: Response: "Let me check your vibe!"
    
    Agent->>Webhook: {response: "Let me check your vibe!"}
    Webhook->>TG: sendMessage("Let me check your vibe!")
    TG->>User: 💭 Let me check your vibe!
    
    Note over AI: Makes tool call decision<br/>Extracts name from context
    
    AI-->>Agent: tool_call: submit_vibe<br/>{name: "John"}
    
    Agent->>Agent: executeTool("submit_vibe")<br/>Fetch image & convert to base64
    
    Agent->>VibeAPI: POST /submit-vibe<br/>{imageData: "data:image/jpeg;base64...", name: "John"}
    
    Note over VibeAPI: AI Vision analyzes photo<br/>Generates vibe score & analysis
    
    VibeAPI->>DB: INSERT vibe_leaderboard entry
    DB-->>VibeAPI: Success
    
    VibeAPI-->>Agent: {score: 87, vibe_analysis: "...", image_url: "..."}
    
    Agent->>AI: Tool result with vibe data
    
    Note over AI: Follows instructions:<br/>"Celebrate with emojis<br/>based on score"
    
    AI-->>Agent: Final response with celebration
    
    Agent-->>Webhook: {response: "🔥 Vibe Score: 87/100...", toolsUsed: ["submit_vibe"]}
    
    Webhook->>TG: sendMessage(response)
    TG->>User: 🔥 Score: 87/100<br/>💭 Crushing it with that confidence!<br/>🏆 Added to leaderboard
```

## Key Changes Implemented

### System Prompt Updates (telegram-webhook/index.ts)

**1. Added to Capabilities List:**
```
- I can analyze photos and give vibe scores using AI vision
```

**2. Added VIBE CHECK TOOL USAGE Section:**
```
VIBE CHECK TOOL USAGE:
- When someone sends a photo AND mentions vibe/score/rate/check/vibes, AUTOMATICALLY use the submit_vibe tool
- Extract the person's name from: their Telegram first name, username, or ask them if both are unavailable
- Be enthusiastic! Say things like "Let me check your vibe!" or "Time for a vibe analysis!"
- After getting the score, celebrate it with emojis and commentary
- If someone sends a photo without vibe keywords, offer: "Want me to check your vibe?"
- The submit_vibe tool requires a 'name' parameter - always provide the person's name
```

**3. Conditional Tool Description:**
- Only shown when `hasAgentTools.submit_vibe` is enabled
- Uses actual Telegram metadata (firstName, telegramUsername) in the prompt

### Model Normalization (telegram-agent/index.ts)

**Handles invalid model names:**
- `gpt-4o` → `google/gemini-2.5-flash`
- Falls back to `google/gemini-2.5-flash` for unknown models
- Ensures tool calls work with Lovable AI Gateway

## Expected Behavior

### Scenario 1: Photo + Vibe Request
```
User: [sends photo] "Rate my vibe!"
Bot: "Let me check your vibe!"
Bot: [calls submit_vibe tool]
Bot: "🔥 Vibe Score: 87/100! You're radiating confidence!"
```

### Scenario 2: Photo + Implicit Request
```
User: [sends photo] "What's my score?"
Bot: "Time for a vibe analysis!"
Bot: [calls submit_vibe with name from Telegram]
Bot: "✨ 92/100 - Absolutely crushing it!"
```

### Scenario 3: Photo Without Request
```
User: [sends photo]
Bot: "Nice photo! Want me to check your vibe?"
User: "Yes!"
Bot: [calls submit_vibe tool]
Bot: "🎯 78/100 - Great energy!"
```

### Scenario 4: Missing Name
```
User: [sends photo] "Rate my vibe!"
Bot: "I'd love to! What's your name?"
User: "Sarah"
Bot: [calls submit_vibe with name="Sarah"]
Bot: "💫 Sarah, your vibe score is 85/100!"
```

## Tool Configuration

The `submit_vibe` tool is:
- ✅ Defined in `telegram-agent/index.ts` (lines 136-148)
- ✅ Enabled in workflow configuration (community settings)
- ✅ Available in agent tools list (HomePage.tsx)
- ✅ Integrated with Lovable AI Gateway
- ✅ Connected to vibe_leaderboard database table
- ✅ Now has system prompt instructions for usage

## Troubleshooting

If tool still doesn't trigger:
1. Check edge function logs for errors
2. Verify `hasAgentTools.submit_vibe` is true
3. Test with explicit keywords: "rate my vibe", "vibe check", "what's my score"
4. Ensure photo is successfully downloaded and passed to agent
5. Check AI model is normalized correctly
