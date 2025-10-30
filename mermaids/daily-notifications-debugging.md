# Daily Notifications – Debugging Map

This document visualizes the exact chain to verify when daily notifications don’t send, plus a minimal one-minute test flow.

## What today’s checks show
- Communities configured: 1 (America/Argentina/Buenos_Aires, time 03:08, enabled=true, token+content present)
- Opted-in sessions: 0 (no proactive_outreach_enabled users found)
- Outreach logs: none recent
- Edge function invoke (manual): success { communities: 1, sent: 0, failed: 0 }
- Webhook logs: received /notifications on and /help in private chat; likely no DB session created/updated
- Cron job: no execution logs observed (may not be scheduled)

## End-to-end chain

```mermaid
flowchart TB
  A[pg_cron every minute] -->|HTTP POST| B[Edge Function: telegram-daily-message]
  B --> C{DB: get communities
  enabled + has content + token}
  C -->|none| Z1[Nothing to do]
  C -->|one or more| D[Check scheduled time
  using community.timezone]
  D -->|no match| Z2[Skip this community]
  D -->|match| E[Query telegram_chat_sessions
  is_active=true & proactive_outreach_enabled=true]
  E -->|0 users| Z3[No recipients → sent=0]
  E -->|>=1 users| F[Send via Telegram Bot API
  with 50ms delay]
  F --> G[Insert outreach_logs
  success/error]
```

## Minimal one-minute test plan

```mermaid
sequenceDiagram
    participant You as Admin
    participant Bot as Telegram Bot
    participant Webhook as telegram-webhook (Edge)
    participant DB as Supabase DB
    participant Daily as telegram-daily-message (Edge)
    participant TG as Telegram API

    Note over You: 1) Create recipients
    You->>Bot: Send any message to start chat
    Bot->>Webhook: update
    Webhook->>DB: INSERT telegram_chat_session
    You->>Bot: /notifications on
    Webhook->>DB: UPDATE proactive_outreach_enabled=true

    Note over You: 2) Force an immediate run
    You->>DB: Set community.timezone='America/Argentina/Buenos_Aires'
    You->>DB: Set daily_message_time to the next minute in UTC

    Note over You: 3) Trigger and observe
    You->>Daily: Manual invoke (POST)
    Daily->>DB: SELECT recipients
    alt recipients >= 1
        Daily->>TG: sendMessage
        TG-->>You: message delivered
        Daily->>DB: INSERT outreach_logs success
    else none
        Daily->>DB: INSERT outreach_logs with reason
    end
```

## Where it’s breaking now
1) No opted-in recipients exist (0 sessions with proactive_outreach_enabled=true)
2) Cron run not observed (function logs empty) → likely not scheduled

## Fix order (fastest path)
1) Ensure pg_cron schedule exists for telegram-daily-message (every minute)
2) In webhook: always create session on first DM to bot and map it to the correct community (via bot token/username)
3) Implement /notifications on|off to toggle proactive_outreach_enabled on that session
4) Manual invoke once to confirm sent>0, then rely on cron
