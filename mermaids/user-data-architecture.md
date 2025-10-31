# User Data Architecture

## Where Users Are Stored

```mermaid
graph TB
    subgraph "User Profile Storage"
        USERS[(users table)]
        style USERS fill:#4ade80
        
        USERS_FIELDS["<b>users table fields:</b><br/>• id (internal UUID)<br/>• auth_user_id (Supabase Auth)<br/>• telegram_user_id (Telegram ID)<br/>• telegram_username<br/>• name<br/>• bio (includes intro)<br/>• email<br/>• avatar_url<br/>• interests_skills<br/>• is_claimed (true/false)<br/>• phone_number<br/>• twitter_handle<br/>• instagram_handle"]
        
        USERS --- USERS_FIELDS
    end
    
    subgraph "Community Membership"
        CM[(community_members)]
        style CM fill:#60a5fa
        
        CM_FIELDS["<b>Links users to communities:</b><br/>• user_id → users.id<br/>• community_id<br/>• role (admin/member)<br/>• joined_at<br/>• group_name<br/>• notes"]
        
        CM --- CM_FIELDS
    end
    
    subgraph "Telegram Activity"
        TCS[(telegram_chat_sessions)]
        style TCS fill:#f59e0b
        
        TCS_FIELDS["<b>Telegram bot interactions:</b><br/>• telegram_chat_id<br/>• telegram_user_id<br/>• telegram_username<br/>• community_id<br/>• message_count<br/>• last_message_at<br/>• proactive_outreach_enabled"]
        
        TCS --- TCS_FIELDS
    end
    
    subgraph "Messages & Intros"
        MSG[(messages table)]
        style MSG fill:#a78bfa
        
        MSG_FIELDS["<b>All messages:</b><br/>• sender_id → users.id<br/>• content<br/>• community_id<br/>• topic_name (e.g. 'intros')<br/>• chat_type<br/>• attachments"]
        
        MSG --- MSG_FIELDS
    end
    
    USERS -.->|"user_id"| CM
    USERS -.->|"telegram_user_id"| TCS
    USERS -.->|"sender_id"| MSG
    CM -.->|"community_id"| TCS
    CM -.->|"community_id"| MSG
```

## How to Query Users for a Specific Community

### 1. Get All Users in Edge City Patagonia

```sql
-- Get community ID first
SELECT id, name FROM communities WHERE name ILIKE '%edge city%patagonia%';
-- Returns: f6850f7e-3744-4e3c-bac3-7fe63242ad42

-- Get all members with full profile info
SELECT 
  u.id,
  u.name,
  u.telegram_username,
  u.telegram_user_id,
  u.email,
  u.bio,
  u.is_claimed,
  u.avatar_url,
  u.interests_skills,
  cm.role,
  cm.joined_at,
  cm.group_name
FROM users u
JOIN community_members cm ON u.id = cm.user_id
WHERE cm.community_id = 'f6850f7e-3744-4e3c-bac3-7fe63242ad42'
ORDER BY cm.joined_at DESC;
```

### 2. Get Telegram Activity for Community Members

```sql
SELECT 
  u.name,
  u.telegram_username,
  tcs.message_count,
  tcs.last_message_at,
  tcs.proactive_outreach_enabled,
  tcs.is_active
FROM telegram_chat_sessions tcs
JOIN users u ON tcs.telegram_user_id = u.telegram_user_id
WHERE tcs.community_id = 'f6850f7e-3744-4e3c-bac3-7fe63242ad42'
ORDER BY tcs.last_message_at DESC;
```

### 3. User Account Types

```mermaid
graph LR
    subgraph "User Types"
        T1[Telegram Only User]
        T2[Web-Claimed User]
        T3[App Signup User]
    end
    
    subgraph "users table states"
        T1 --> S1["is_claimed: false<br/>auth_user_id: NULL<br/>telegram_user_id: ✓"]
        T2 --> S2["is_claimed: true<br/>auth_user_id: ✓<br/>telegram_user_id: ✓"]
        T3 --> S3["is_claimed: true<br/>auth_user_id: ✓<br/>telegram_user_id: NULL"]
    end
    
    style S1 fill:#fbbf24
    style S2 fill:#4ade80
    style S3 fill:#60a5fa
```

## Key Points

1. **Single Source of Truth**: `users` table stores ALL user profiles
2. **Community Linking**: `community_members` table links users to communities
3. **Telegram Activity**: `telegram_chat_sessions` tracks bot interactions
4. **Intro Storage**: Intros are saved directly in `users.bio` field (not memories table)
5. **Account Status**: `is_claimed` indicates if user has web/app login credentials

## Accessing via UI

You can view community members in the dashboard:
- Go to: `/community/{community_id}` 
- Click "Members" tab
- See full member list with roles and join dates
