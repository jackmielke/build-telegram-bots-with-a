# Broadcast Messaging System

## System Architecture

```mermaid
graph TB
    Admin[Community Admin] -->|Enables broadcast tool| UI[Custom Tools UI]
    UI -->|Creates/Enables tool entry| DB[(Database)]
    
    User[Telegram User] -->|Sends message| Bot[Telegram Bot]
    Bot -->|Webhook| AgentFunc[telegram-agent Function]
    AgentFunc -->|Analyzes context| AI[AI Agent]
    
    AI -->|Decides to broadcast| BroadcastTool[Broadcast Tool]
    BroadcastTool -->|Invokes| BroadcastFunc[telegram-broadcast Function]
    
    BroadcastFunc -->|Queries active sessions| DB
    DB -->|Returns recipients| BroadcastFunc
    
    BroadcastFunc -->|Sends messages| TelegramAPI[Telegram API]
    TelegramAPI -->|Delivers| Recipients[All Chat Participants]
    
    BroadcastFunc -->|Logs results| LogsTable[(custom_tool_logs)]
```

## Broadcast Flow Sequence

```mermaid
sequenceDiagram
    participant Admin
    participant UI as Custom Tools UI
    participant DB as Database
    participant User as Telegram User
    participant Bot as Telegram Bot
    participant Agent as AI Agent
    participant Broadcast as Broadcast Function
    participant Telegram as Telegram API
    participant Recipients
    
    Admin->>UI: Enable "Broadcast Messaging" toggle
    UI->>DB: Create/enable broadcast_message tool
    DB-->>UI: Tool created/enabled
    
    Note over UI: Tool now available to AI agent
    
    User->>Bot: Sends message: "Announce meeting tomorrow"
    Bot->>Agent: Process message with available tools
    Agent->>Agent: Analyzes: needs to notify everyone
    Agent->>Broadcast: invoke broadcast_message(message)
    
    Broadcast->>DB: Get community telegram_bot_token
    DB-->>Broadcast: Returns bot token
    
    Broadcast->>DB: Query active chat sessions
    Note over Broadcast,DB: Filter: is_active=true AND<br/>proactive_outreach_enabled=true
    DB-->>Broadcast: Returns eligible recipients
    
    loop For each recipient
        Broadcast->>Telegram: POST /sendMessage
        Telegram->>Recipients: Deliver message
        Telegram-->>Broadcast: Success/failure
    end
    
    Broadcast->>DB: Log execution to custom_tool_logs
    Broadcast-->>Agent: Return results (sent/failed counts)
    Agent->>Bot: Generate response confirmation
    Bot->>User: "✅ Broadcast sent to 24 users"
```

## Tool Configuration

```mermaid
graph LR
    subgraph "Broadcast Tool Definition"
        Name[name: broadcast_message]
        Display[display_name: Broadcast Message]
        Desc[description: Send to all users]
        
        subgraph "Parameters"
            P1[message: string required]
            P2[include_opted_out: boolean optional]
        end
        
        subgraph "Request Template"
            T1[community_id: current community]
            T2[message: from parameter]
            T3[filter.include_opted_out: from parameter]
        end
    end
    
    Name --> Display
    Display --> Desc
    Desc --> Parameters
    Parameters --> Request
    Request[Request Template] --> Endpoint[telegram-broadcast function]
```

## Recipient Filtering Logic

```mermaid
flowchart TD
    Start[Start: Get all chat sessions] --> FilterCommunity{Filter by<br/>community_id}
    FilterCommunity --> FilterActive{is_active = true?}
    FilterActive -->|No| Skip1[Skip user]
    FilterActive -->|Yes| CheckOptIn{include_opted_out<br/>parameter?}
    
    CheckOptIn -->|true| CheckMinMessages{min_message_count<br/>filter set?}
    CheckOptIn -->|false| CheckProactive{proactive_outreach_enabled<br/>= true?}
    
    CheckProactive -->|No| Skip2[Skip user]
    CheckProactive -->|Yes| CheckMinMessages
    
    CheckMinMessages -->|Yes| CheckCount{message_count >=<br/>min_message_count?}
    CheckMinMessages -->|No| Include[Include in broadcast]
    
    CheckCount -->|No| Skip3[Skip user]
    CheckCount -->|Yes| Include
    
    Include --> SendMessage[Send message via Telegram API]
    SendMessage --> RateLimit[Wait 50ms rate limit]
    RateLimit --> LogResult[Log success/failure]
```

## State Diagram: Tool Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Disabled: Tool not created
    
    Disabled --> Creating: Admin enables toggle
    Creating --> Enabled: Tool entry created in DB
    
    Enabled --> InUse: Agent invokes tool
    InUse --> Enabled: Broadcast completed
    
    Enabled --> Disabled: Admin disables toggle
    Disabled --> Enabled: Admin re-enables
    
    InUse --> Error: Broadcast fails
    Error --> Enabled: Error logged
    
    note right of Enabled
        Tool available to AI agent
        Shows in agent's tool list
    end note
    
    note right of InUse
        Queries recipients
        Sends messages
        Logs results
    end note
```

## Key Features

### Automatic Tool Integration
- When enabled, creates a `custom_tools` entry automatically
- AI agent sees it as an available tool
- Agent decides when to use it based on conversation context

### Smart Filtering
- Only sends to active chat sessions
- Respects user opt-in preferences (proactive_outreach_enabled)
- Optional filters for message count threshold
- Can optionally include opted-out users

### Safety & Rate Limiting
- 50ms delay between messages to avoid Telegram rate limits
- Comprehensive error logging
- Returns detailed results (sent/failed counts)
- Logs each execution to `custom_tool_logs` table

### Use Cases
1. **Event Announcements**: "Meeting tomorrow at 3pm"
2. **System Updates**: "New features available!"
3. **Community Alerts**: "Emergency notice for all members"
4. **Survey Requests**: "Please fill out this quick survey"
5. **Milestone Celebrations**: "We hit 100 members! 🎉"

## Database Tables Involved

```mermaid
erDiagram
    custom_tools ||--o{ custom_tool_logs : "logs executions"
    communities ||--o{ telegram_chat_sessions : "has sessions"
    telegram_chat_sessions ||--o{ messages : "contains"
    
    custom_tools {
        uuid id PK
        uuid community_id FK
        string name
        boolean is_enabled
        jsonb parameters
    }
    
    telegram_chat_sessions {
        uuid id PK
        uuid community_id FK
        bigint telegram_chat_id
        boolean is_active
        boolean proactive_outreach_enabled
        int message_count
    }
    
    custom_tool_logs {
        uuid id PK
        uuid tool_id FK
        uuid community_id FK
        jsonb input_data
        jsonb output_data
        timestamp executed_at
    }
```

## Configuration Example

### Enable in UI
1. Navigate to Custom Tools section
2. Find "Broadcast Messaging" built-in tool
3. Toggle switch to enable
4. Tool is immediately available to AI agent

### Agent Usage
The AI agent will automatically invoke this tool when it detects:
- User wants to notify everyone
- Announcement needs to be shared
- Important updates for all members
- Keywords like "tell everyone", "announce to all", "notify all users"

### Example Conversation
```
User: "Can you announce to everyone that the meeting is moved to 3pm tomorrow?"

Bot: [Internally invokes broadcast_message tool]
     ✅ "I've sent the announcement to all 42 members who have chatted with me.
        Successfully delivered to 40 users, 2 had delivery issues."
```
