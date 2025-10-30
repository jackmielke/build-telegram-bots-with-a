# Profile Backfill System

This diagram shows how we'll backfill user profiles from existing intro messages in Telegram.

## Current State vs Desired State

```mermaid
flowchart TB
    subgraph current[Current State - Broken]
        C1[9,021 users in DB]
        C2[Only 7,624 have bios]
        C3[432 Telegram users]
        C4[10+ intro messages NOT processed]
        C1 --> C2
        C1 --> C3
        C3 --> C4
    end
    
    subgraph desired[Desired State - Working]
        D1[Click Backfill Button]
        D2[Find all messages where topic_name='Intros']
        D3[Filter: sender has NO bio]
        D4[For each message: call generate-intro]
        D5[AI formats intro → saves to users.bio]
        D6[All intro authors have profiles!]
        
        D1 --> D2
        D2 --> D3
        D3 --> D4
        D4 --> D5
        D5 --> D6
    end
```

## Backfill Process Flow

```mermaid
sequenceDiagram
    participant Admin as Admin Dashboard
    participant Edge as backfill-intros Edge Function
    participant DB as Supabase DB
    participant GenIntro as generate-intro Function
    participant AI as Lovable AI

    Admin->>Edge: Click "Backfill Profiles" button
    Edge->>DB: SELECT messages WHERE topic_name ILIKE '%intro%'<br/>AND sender has no bio
    DB-->>Edge: Return 10+ intro messages
    
    loop For each intro message
        Edge->>GenIntro: POST { singleMessage, userId, communityId }
        GenIntro->>AI: Generate professional bio
        AI-->>GenIntro: Formatted bio text
        GenIntro->>DB: UPDATE users SET bio = formatted_text
        GenIntro-->>Edge: { success: true }
    end
    
    Edge-->>Admin: { processed: 10, successful: 10, failed: 0 }
    Admin->>Admin: Show toast: "10 profiles created!"
```

## Database Relationships

```mermaid
erDiagram
    USERS ||--o{ MESSAGES : sends
    USERS {
        uuid id PK
        text name
        text bio "May be NULL"
        bigint telegram_user_id
        text telegram_username
    }
    MESSAGES {
        uuid id PK
        uuid sender_id FK
        text content "The intro message text"
        text topic_name "Filter by 'Intros'"
        timestamp created_at
    }
    
    USERS ||--o{ COMMUNITY_MEMBERS : belongs_to
    COMMUNITY_MEMBERS {
        uuid user_id FK
        uuid community_id FK
    }
```

## Key Implementation Details

1. **Edge Function**: `supabase/functions/backfill-intros/index.ts`
   - Queries all intro messages from users without bios
   - Calls `generate-intro` for each one
   - Returns stats: processed, successful, failed

2. **UI Button**: Add to `UnifiedAgentSetup.tsx`
   - Only visible to admins
   - Shows loading state during processing
   - Displays success/error toast

3. **Safety Measures**:
   - Only processes messages > 50 characters
   - Skips users who already have bios
   - Rate limits: 50ms delay between calls
   - Logs all successes/failures

4. **Reusable**: 
   - Can be run multiple times safely
   - Only processes NEW intro messages
   - Won't overwrite existing bios
