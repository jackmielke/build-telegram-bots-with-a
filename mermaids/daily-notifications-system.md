# Daily Notifications System

## System Overview

This diagram shows how the daily notification system works for Telegram communities.

```mermaid
sequenceDiagram
    participant Cron as pg_cron Job<br/>(Runs Every Minute)
    participant Edge as telegram-daily-message<br/>Edge Function
    participant DB as Database
    participant Telegram as Telegram API
    participant Users as Community Members

    Note over Cron: Every minute at :00 seconds
    Cron->>Edge: HTTP POST<br/>trigger function
    
    Edge->>DB: get_communities_for_daily_message()
    DB-->>Edge: List of communities with<br/>daily_message_enabled=true
    
    loop For each community
        Edge->>DB: SELECT daily_message_time, timezone<br/>WHERE id = community_id
        DB-->>Edge: UTC time & timezone info
        
        alt Time matches current UTC hour:minute
            Note over Edge: ✅ Time match!<br/>Proceed with sending
            
            Edge->>DB: SELECT telegram_chat_sessions<br/>WHERE proactive_outreach_enabled=true
            DB-->>Edge: List of opted-in users
            
            loop For each user session
                Edge->>Telegram: POST /sendMessage<br/>with daily_message_content
                Telegram-->>Users: Deliver message
                Telegram-->>Edge: Success/Failure response
                Note over Edge: Wait 50ms to avoid rate limiting
            end
        else Time doesn't match
            Note over Edge: ⏭️ Skip this community<br/>Not the scheduled time yet
        end
    end
    
    Edge->>Edge: Log results:<br/>✅ Sent: N messages<br/>❌ Failed: M messages
```

## Key Components

### 1. Cron Job
- **Frequency**: Runs every minute (`* * * * *`)
- **Function**: Calls the telegram-daily-message edge function
- **Setup**: Uses pg_cron extension in Supabase
- **HTTP Call**: Makes POST request to edge function endpoint

### 2. Database Function
```sql
get_communities_for_daily_message()
```
Returns communities where:
- `daily_message_enabled = true`
- `daily_message_content IS NOT NULL`
- `telegram_bot_token IS NOT NULL`

### 3. Timezone Handling

```mermaid
graph LR
    A[User sets time in<br/>Buenos Aires TZ] -->|09:00 ART| B[Frontend converts<br/>to UTC]
    B -->|12:00 UTC| C[Stored in DB]
    C --> D[Cron checks<br/>every minute]
    D -->|12:00 UTC?| E{Match?}
    E -->|Yes| F[Send messages]
    E -->|No| G[Skip community]
```

**Example**:
- User in Buenos Aires sets: `09:00` (local time)
- System stores: `12:00` (UTC, because ART is UTC-3)
- Cron runs at: `12:00` UTC
- Messages sent at what users see as: `09:00` in Buenos Aires

### 4. User Opt-in System
Messages are ONLY sent to users where:
- `telegram_chat_sessions.is_active = true`
- `telegram_chat_sessions.proactive_outreach_enabled = true`

### 5. Rate Limiting
- 50ms delay between each message
- Prevents Telegram API rate limits
- Ensures reliable delivery

## Data Flow

```mermaid
graph TB
    A[Admin configures in UI] --> B[Daily Notifications Settings]
    B --> C{Enabled?}
    C -->|Yes| D[Store settings in communities table]
    C -->|No| E[Nothing happens]
    
    D --> F[pg_cron triggers<br/>every minute]
    F --> G[Edge function checks<br/>current UTC time]
    G --> H{Time matches<br/>community's<br/>scheduled time?}
    
    H -->|No| I[Skip community]
    H -->|Yes| J[Query telegram_chat_sessions]
    
    J --> K[Filter by<br/>proactive_outreach_enabled]
    K --> L[Send to each user<br/>via Telegram API]
    
    L --> M[Log success/failure]
    M --> N[Wait 50ms]
    N --> L
    
    style D fill:#bbf,stroke:#333
    style L fill:#afa,stroke:#333
    style H fill:#ffa,stroke:#333
```

## Configuration Steps

1. **Enable Daily Messages** (Admin UI)
   - Toggle `daily_message_enabled`
   - Set `daily_message_content` (the message text)
   - Choose `timezone` (default: Buenos Aires)
   - Set `daily_message_time` (displayed in local TZ, stored as UTC)

2. **User Opt-in** (Telegram Bot)
   - Users enable `proactive_outreach_enabled` via bot commands
   - Stored in `telegram_chat_sessions` table

3. **Automatic Execution**
   - Cron job runs every minute
   - Checks all communities for time matches
   - Sends messages to opted-in users

## Troubleshooting

### Messages not sending?
1. Check `daily_message_enabled = true` in communities table
2. Verify `telegram_bot_token` is set correctly
3. Check logs in edge function
4. Confirm users have `proactive_outreach_enabled = true`
5. Verify time conversion is correct (check UTC time in DB)

### Wrong time?
1. Verify timezone is set correctly (e.g., 'America/Argentina/Buenos_Aires')
2. Check stored UTC time in database matches expected
3. Use edge function logs to see what time it's checking

### Rate limiting?
- Messages are sent with 50ms delay between each
- If hitting limits, increase delay in edge function code
