# Daily Notifications System - Complete Diagnosis

## 🔴 Critical Issues Found

### 1. **No Active Recipients (PRIMARY ISSUE)**
```
Query Result: 0 active telegram_chat_sessions with proactive_outreach_enabled=true
```
- Communities have daily messages enabled
- But NO users have opted in to receive them
- The edge function runs successfully but sends 0 messages

### 2. **Cron Job Running Every Minute (PERFORMANCE ISSUE)**
```sql
-- Job ID 4: Runs EVERY MINUTE (wasteful)
schedule: * * * * *

-- Job ID 3: Runs every hour at :00
schedule: 0 * * * *
```
**Problem**: Having two jobs (especially one every minute) wastes resources when you only need to check once per hour or even less frequently.

### 3. **Timezone Conversion Logic**
```
Communities configured:
- Vibe Check Bot: 03:08:00 UTC (timezone: America/Argentina/Buenos_Aires)
- TOMAS BOT: 03:00:00 UTC (timezone: America/Argentina/Buenos_Aires)
```
The edge function stores times in UTC but doesn't convert from user's timezone to UTC during setup.

---

## 📊 System Architecture

```mermaid
flowchart TB
    subgraph Cron["Cron Scheduler"]
        J4[Job 4: Every Minute<br/>* * * * *]
        J3[Job 3: Every Hour<br/>0 * * * *]
    end
    
    subgraph Edge["Edge Function<br/>telegram-daily-message"]
        E1[Check Current UTC Time]
        E2[Query: get_communities_for_daily_message]
        E3{Any communities<br/>enabled?}
        E4[For each community:<br/>Match scheduled time]
        E5{Time match?}
        E6[Query active sessions<br/>proactive_outreach_enabled=true]
        E7{Any recipients?}
        E8[Send to Telegram API]
    end
    
    subgraph DB["Database"]
        D1[(communities<br/>daily_message_enabled=true)]
        D2[(telegram_chat_sessions<br/>is_active=true<br/>proactive_outreach_enabled=true)]
        D3[(outreach_logs)]
    end
    
    J4 -->|Triggers| E1
    J3 -->|Triggers| E1
    E1 --> E2
    E2 --> D1
    D1 --> E3
    E3 -->|Yes| E4
    E3 -->|No| END1[Return: No communities]
    E4 --> E5
    E5 -->|Yes| E6
    E5 -->|No| SKIP[Skip community]
    E6 --> D2
    D2 --> E7
    E7 -->|Yes| E8
    E7 -->|No| END2[sent=0, failed=0]
    E8 -->|Success| D3
    E8 -->|Failure| D3
    
    style E7 fill:#ff6b6b
    style D2 fill:#ff6b6b
    style J4 fill:#ffd93d
```

---

## 🔍 Current State

### Communities with Daily Messages Enabled
| Community | Time (UTC) | Timezone | Content | Enabled |
|-----------|-----------|----------|---------|---------|
| Vibe Check Bot | 03:08:00 | America/Argentina/Buenos_Aires | ✅ Set | ✅ True |
| TOMAS BOT | 03:00:00 | America/Argentina/Buenos_Aires | ✅ Set | ✅ True |

### Active Chat Sessions (Recipients)
```
Total active sessions: 0
Sessions with proactive_outreach_enabled=true: 0
```
**❌ This is why no messages are being sent!**

---

## 🔧 Root Cause Analysis

```mermaid
flowchart LR
    A[User starts chat<br/>with bot] --> B{Is session<br/>created?}
    B -->|No| FAIL1[❌ No session<br/>in DB]
    B -->|Yes| C{Is proactive_outreach<br/>enabled?}
    C -->|No Default| FAIL2[❌ proactive_outreach_enabled<br/>= false]
    C -->|Yes| D[User can receive<br/>daily messages]
    
    style FAIL1 fill:#ff6b6b
    style FAIL2 fill:#ff6b6b
    style D fill:#51cf66
```

**Missing Implementation:**
1. Automatic session creation when users start a chat
2. `/notifications on` command implementation
3. Default opt-in mechanism or onboarding flow

---

## ✅ Recommended Fixes (Priority Order)

### Fix 1: Consolidate Cron Jobs
```sql
-- Delete the every-minute job (wasteful)
SELECT cron.unschedule(4);

-- Keep only the hourly job (or make it every 15 minutes)
SELECT cron.schedule(
  'telegram-daily-message-cron',
  '*/15 * * * *',  -- Every 15 minutes is sufficient
  $$
  SELECT net.http_post(
    url:='https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-daily-message',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [KEY]"}'::jsonb
  );
  $$
);
```

### Fix 2: Implement Session Creation
Update `telegram-webhook` to automatically create sessions:
```typescript
// When user sends first message
const { data: session } = await supabase
  .from('telegram_chat_sessions')
  .upsert({
    telegram_chat_id: message.chat.id,
    community_id: community.id,
    is_active: true,
    proactive_outreach_enabled: false  // Default off
  });
```

### Fix 3: Implement /notifications Command
```typescript
if (message.text === '/notifications on') {
  await supabase
    .from('telegram_chat_sessions')
    .update({ proactive_outreach_enabled: true })
    .eq('telegram_chat_id', message.chat.id);
}
```

### Fix 4: Test Flow
```mermaid
sequenceDiagram
    participant Admin
    participant Bot
    participant Webhook
    participant DB
    participant Cron
    participant Daily
    
    Admin->>Bot: Send "hi"
    Bot->>Webhook: Process message
    Webhook->>DB: Create session<br/>proactive_outreach_enabled=false
    
    Admin->>Bot: /notifications on
    Bot->>Webhook: Process command
    Webhook->>DB: Update session<br/>proactive_outreach_enabled=true
    
    Note over Cron: Wait for scheduled time
    Cron->>Daily: Trigger edge function
    Daily->>DB: Query sessions<br/>proactive_outreach_enabled=true
    DB-->>Daily: Return 1 session
    Daily->>Bot: Send daily message
    Bot-->>Admin: Message delivered ✅
```

---

## 🧪 Quick Test (Manual Trigger)

To test immediately without waiting for cron:
1. Message the bot to create a session
2. Run `/notifications on` 
3. Set community's `daily_message_time` to current UTC time + 1 minute
4. Manually invoke the edge function:
```bash
curl -X POST https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-daily-message \
  -H "Authorization: Bearer [ANON_KEY]"
```

Expected result: `{ sent: 1, failed: 0 }`
