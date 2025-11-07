# Member Provisioning & DM Eligibility Flow

```mermaid
sequenceDiagram
    participant TG as Telegram User
    participant BOT as Telegram Bot
    participant WEB as telegram-webhook (Edge)
    participant DB as Supabase DB

    TG->>BOT: Message (group or DM)
    BOT->>WEB: Webhook payload
    WEB->>DB: findOrCreateUser(...)
    alt User exists (by telegram_user_id / username)
        WEB->>DB: update telegram fields (if needed)
        WEB->>DB: addUserToCommunity(user_id, community_id)
    else Create new user
        WEB->>DB: insert users (is_claimed=false)
        WEB->>DB: addUserToCommunity(new_user_id, community_id)
    end

    alt Private chat
        WEB->>DB: upsert telegram_chat_sessions
        Note right of DB: proactive_outreach_enabled=true<br/>is_active=true<br/>last_message_at=now
    else Group/Supergroup
        Note right of WEB: No DM session (Telegram limitation)
    end

    BOT-->>TG: Replies
```

```mermaid
graph TD
    A[community_members] -- who belongs --> B((Community))
    A -. not used for DMs .-> X[Broadcast]
    C[telegram_chat_sessions] -- who can be DM'd --> X

    style A fill:#60a5fa
    style C fill:#4ade80
    style X fill:#a78bfa
```

Key points:
- Existing users are now always added to the community on first contact
- DM eligibility requires a private chat session in `telegram_chat_sessions`
- Group-only interactions cannot be DM'd by the bot due to Telegram rules
