# User Preferences System Architecture

```mermaid
graph TB
    subgraph "Database Layer"
        M[memories table]
        M --> MT{memory_type}
        MT -->|community| CM[Community Memories]
        MT -->|user_preference| UP[User Preferences]
        
        M -.-> Fields[" id, community_id, created_by,<br/>content, tags, metadata,<br/>memory_type"]
    end
    
    subgraph "Agent Tools Layer"
        subgraph "Community Memory Tools"
            T1[search_memory]
            T2[save_memory]
        end
        
        subgraph "User Preference Tools NEW"
            T3[get_user_preferences]
            T4[save_user_preference]
            T5[update_user_preference]
            T6[search_user_preferences]
        end
    end
    
    subgraph "Agent Execution"
        TW[Telegram Webhook]
        WA[Webhook Agent]
        TW --> CTX[User Context:<br/>telegram_user_id<br/>community_id]
        WA --> CTX2[User Context:<br/>user_id<br/>community_id]
    end
    
    subgraph "Usage Examples"
        E1["User: I prefer morning meetings"]
        E2["Agent: save_user_preference<br/>{'{'}category: schedule,<br/>preference: morning_meetings{'}'}"]
        E3["User: What time do I like to meet?"]
        E4["Agent: get_user_preferences<br/>{'{'}category: schedule{'}'}"]
    end
    
    T3 --> UP
    T4 --> UP
    T5 --> UP
    T6 --> UP
    
    T1 --> CM
    T2 --> CM
    
    CTX --> T3
    CTX --> T4
    CTX --> T5
    CTX --> T6
    
    E1 --> E2
    E2 --> T4
    E3 --> E4
    E4 --> T3
    
    style UP fill:#e1f5ff
    style CM fill:#fff4e1
    style T3 fill:#d4edda
    style T4 fill:#d4edda
    style T5 fill:#d4edda
    style T6 fill:#d4edda
```

## Flow: Saving User Preference

```mermaid
sequenceDiagram
    participant U as User (Telegram)
    participant TW as telegram-webhook
    participant AI as AI Agent
    participant DB as Supabase (memories)
    
    U->>TW: "I prefer vegan food"
    TW->>AI: {messages, user_id, community_id}
    
    AI->>AI: Analyze: User stated preference
    AI->>AI: Tool Call: save_user_preference
    
    AI->>TW: save_user_preference({<br/>  category: "dietary",<br/>  preference: "vegan",<br/>  details: "User prefers vegan food"<br/>})
    
    TW->>DB: INSERT INTO memories<br/>(user_id, community_id,<br/>content, tags, memory_type)<br/>VALUES (..., 'user_preference')
    
    DB-->>TW: ✓ Saved
    TW-->>AI: ✓ Tool result
    AI-->>U: "Got it! I've noted your vegan preference."
```

## Flow: Retrieving User Preferences

```mermaid
sequenceDiagram
    participant U as User (Telegram)
    participant TW as telegram-webhook
    participant AI as AI Agent
    participant DB as Supabase (memories)
    
    U->>TW: "What do you know about my food preferences?"
    TW->>AI: {messages, user_id, community_id}
    
    AI->>AI: Tool Call: get_user_preferences<br/>(category: "dietary")
    
    AI->>TW: get_user_preferences({<br/>  category: "dietary"<br/>})
    
    TW->>DB: SELECT * FROM memories<br/>WHERE user_id = $1<br/>AND community_id = $2<br/>AND memory_type = 'user_preference'<br/>AND tags @> ARRAY['dietary']
    
    DB-->>TW: [{preference: "vegan", ...}]
    TW-->>AI: Tool result: "User prefers vegan food"
    AI-->>U: "You've mentioned you prefer vegan food!"
```

## Schema Changes Needed

```sql
-- Add memory_type column to memories table
ALTER TABLE memories 
ADD COLUMN memory_type TEXT DEFAULT 'community' 
CHECK (memory_type IN ('community', 'user_preference'));

-- Add index for faster user preference queries
CREATE INDEX idx_memories_user_preferences 
ON memories(created_by, community_id, memory_type) 
WHERE memory_type = 'user_preference';

-- Add RLS policy for user preferences
CREATE POLICY "Users can view their own preferences"
ON memories FOR SELECT
USING (
  memory_type = 'user_preference' 
  AND created_by IN (
    SELECT id FROM users WHERE auth_user_id = auth.uid()
  )
);
```

## Tool Definitions

### 1. get_user_preferences
```typescript
{
  name: "get_user_preferences",
  description: "Retrieve all preferences/memories for the current user. Use this to remember user-specific information like dietary restrictions, meeting preferences, communication style, etc.",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "Optional category to filter by (e.g., 'dietary', 'schedule', 'communication')"
      }
    }
  }
}
```

### 2. save_user_preference
```typescript
{
  name: "save_user_preference",
  description: "Save a new preference/memory for the current user. Use when user shares personal preferences, habits, or information they want remembered.",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "Category of preference (e.g., 'dietary', 'schedule', 'communication')"
      },
      preference: {
        type: "string",
        description: "Short label for the preference (e.g., 'vegan', 'morning_person')"
      },
      details: {
        type: "string",
        description: "Full details about this preference"
      }
    },
    required: ["category", "preference", "details"]
  }
}
```

### 3. update_user_preference
```typescript
{
  name: "update_user_preference",
  description: "Update an existing user preference",
  parameters: {
    type: "object",
    properties: {
      preference_id: {
        type: "string",
        description: "ID of the preference to update"
      },
      details: {
        type: "string",
        description: "Updated details"
      }
    },
    required: ["preference_id", "details"]
  }
}
```

### 4. search_user_preferences
```typescript
{
  name: "search_user_preferences",
  description: "Search through user's preferences using keywords",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query"
      }
    },
    required: ["query"]
  }
}
```

## Key Features

✅ **Privacy**: User preferences only accessible to that user + agents  
✅ **Context-Aware**: Agents automatically get user context from telegram_user_id  
✅ **Organized**: Category-based tagging (dietary, schedule, communication, etc.)  
✅ **Searchable**: Full-text and semantic search within user preferences  
✅ **Backward Compatible**: Existing community memories unchanged  
✅ **Flexible**: Can store any type of user preference or personal memory  

## Example Use Cases

1. **Dietary Preferences**: "I'm vegan" → Agent remembers for event planning
2. **Schedule Preferences**: "I prefer morning meetings" → Agent suggests morning times
3. **Communication Style**: "Keep messages brief" → Agent adjusts tone
4. **Personal Context**: "I'm learning Spanish" → Agent can reference this later
5. **Project Interests**: "I want to build a mobile app" → Agent suggests relevant events/people
