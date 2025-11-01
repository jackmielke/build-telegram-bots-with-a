# Vibe Submission System Flow

This diagram shows how the vibe leaderboard submission works when users send photos to the Telegram bot.

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
    
    Note over Webhook: Downloads photo from<br/>Telegram servers
    
    Webhook->>Agent: invoke telegram-agent<br/>(imageUrl, userMessage, history)
    
    Agent->>AI: Chat completion request<br/>(tools: submit_vibe, etc.)
    
    Note over AI: Sees image + message<br/>Decides to use submit_vibe tool
    
    AI-->>Agent: tool_call: submit_vibe<br/>{name: "John"}
    
    Agent->>Agent: executeTool("submit_vibe")
    
    Note over Agent: Fetch image from URL<br/>Convert to base64
    
    Agent->>VibeAPI: POST /submit-vibe<br/>{imageData: "data:image/jpeg;base64...", name: "John"}
    
    Note over VibeAPI: AI analyzes photo<br/>Generates vibe score & analysis
    
    VibeAPI->>DB: Insert vibe_leaderboard entry
    DB-->>VibeAPI: Success
    
    VibeAPI-->>Agent: {score: 87, vibe_analysis: "...", image_url: "..."}
    
    Agent->>AI: Tool result with vibe data
    
    AI-->>Agent: Final response message
    
    Agent-->>Webhook: {response: "✨ Vibe Score: 87/100...", toolsUsed: ["submit_vibe"]}
    
    Webhook->>TG: sendMessage(response)
    TG->>User: 🎯 Score: 87/100<br/>💭 Crushing it with that smile!<br/>🏆 Added to leaderboard
```

## Key Components

### Tool Definition
- **Name**: `submit_vibe`
- **Trigger**: When user sends photo and asks about their vibe/wants rating
- **Input**: Person's name (extracted from context or username)
- **Output**: Vibe score (0-100) + AI-generated analysis

### Image Processing Flow
1. **Telegram** provides image URL via Telegram Bot API
2. **Agent** fetches image from URL
3. **Agent** converts to base64 with proper MIME type
4. **Submit-vibe API** receives base64 data
5. **Submit-vibe API** analyzes with AI vision
6. **Result** stored in leaderboard

### Tool Enablement
The `submit_vibe` tool is available alongside:
- web_search
- search_memory
- search_chat_history
- save_memory
- get_member_profiles
- semantic_profile_search
- scrape_webpage

Admins can enable/disable tools in the Agent Configuration UI.

## Example Interactions

**User sends selfie + "What's my vibe?"**
→ Bot: "✨ Analyzing your vibe..."
→ Bot: "🎯 Score: 92/100 - You're radiating confidence! 🔥"

**User sends group photo + "Rate us!"**
→ Bot extracts first name from message
→ Submits vibe score
→ Returns leaderboard entry confirmation
