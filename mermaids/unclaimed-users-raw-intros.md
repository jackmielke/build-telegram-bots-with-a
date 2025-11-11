# Unclaimed Users & Raw Intro Storage

This diagram shows how users are automatically provisioned as unclaimed members and how intro messages are stored word-for-word.

## Auto-Provisioning Flow

```mermaid
sequenceDiagram
    participant TG as Telegram User
    participant BOT as Telegram Bot
    participant WH as telegram-webhook
    participant DB as Supabase DB
    
    TG->>BOT: Sends ANY message
    BOT->>WH: Webhook payload
    
    Note over WH: For EVERY message
    WH->>WH: findOrCreateUser()
    
    alt User exists
        WH->>DB: Update last_seen if needed
        WH->>DB: Ensure in community_members
    else User does NOT exist
        WH->>DB: INSERT users (is_claimed=false)
        WH->>DB: INSERT community_members (role='member')
        Note right of DB: Auto-provisioned as<br/>unclaimed member
    end
    
    WH->>DB: Store message
    BOT-->>TG: Bot response (if enabled)
```

## Raw Intro Storage Flow

```mermaid
sequenceDiagram
    participant USER as Telegram User
    participant BOT as Telegram Bot
    participant WH as telegram-webhook
    participant DB as users.bio
    
    USER->>BOT: Posts message in #intros thread
    BOT->>WH: Message payload
    
    WH->>WH: Check if in intro thread
    Note over WH: Thread name contains:<br/>'intros', 'introductions', etc.
    
    alt Is intro thread AND message > 50 chars
        WH->>DB: UPDATE users SET bio = raw_message_text
        Note right of DB: Stored word-for-word<br/>No AI formatting
        WH-->>USER: ✅ Bio saved (silent)
    else Not intro thread
        WH-->>USER: Message stored, no bio update
    end
```

## User States

```mermaid
stateDiagram-v2
    [*] --> UnclaimedMember: First message
    
    UnclaimedMember: is_claimed = false
    UnclaimedMember: in community_members
    UnclaimedMember: bio = raw intro text
    
    UnclaimedMember --> ClaimedProfile: User claims via web/verification
    
    ClaimedProfile: is_claimed = true
    ClaimedProfile: auth_user_id set
    ClaimedProfile: can edit bio
    ClaimedProfile: can AI enhance bio
    
    ClaimedProfile --> [*]
```

## Key Points

1. **100% Capture**: Every message sender is auto-provisioned
2. **Unclaimed by Default**: New users have `is_claimed=false`
3. **Raw Storage**: Intro messages stored exactly as written
4. **No AI on Entry**: AI enhancement only happens when admin/user requests it
5. **Silent Updates**: Bio is saved without notifying the user in chat
6. **Thread Detection**: Automatic based on thread name matching

## Configuration

Auto-intro storage requires:
- `community_workflows.workflow_type = 'telegram_integration'`
- `configuration.auto_intro_generation.enabled = true`
- `configuration.auto_intro_generation.thread_names = ['intros', ...]`
