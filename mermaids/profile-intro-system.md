# Profile & Intro System - Complete Implementation

This diagram shows the complete profile and intro generation system with magic link authentication and backfill capabilities.

## Current Implementation

```mermaid
flowchart TB
    subgraph telegram[Telegram Auto-Claim Flow]
        T1[User clicks /start in bot]
        T2[Bot generates magic link token]
        T3[Bot sends 2 messages:<br/>1. Welcome<br/>2. Magic link to bot-builder.app]
        T4[User clicks link → /claim page]
        T5[validate-magic-link validates token]
        T6[Creates Supabase auth user if needed]
        T7[Auto-login with OTP]
        T8[Redirect to /profile page]
        
        T1 --> T2 --> T3 --> T4 --> T5 --> T6 --> T7 --> T8
    end
    
    subgraph intro[Intro Generation & Storage]
        I1[User posts intro in Telegram 'Intros' topic]
        I2[Message stored in messages table]
        I3[Admin clicks 'Backfill Profiles' button]
        I4[backfill-intros edge function]
        I5[Finds all intro messages from users without bios]
        I6[Calls generate-intro for each message]
        I7[AI formats intro text]
        I8[Bio saved to users.bio field]
        
        I1 --> I2
        I3 --> I4 --> I5 --> I6 --> I7 --> I8
    end
    
    subgraph web[Web Profile Management]
        W1[User on /profile page]
        W2[Edit name, bio, profile photo]
        W3[Upload to avatars bucket]
        W4[Save to users table]
        W5[Profile updated! ✓]
        
        W1 --> W2 --> W3 --> W4 --> W5
    end
    
    T8 -.-> W1
    I8 -.-> W1
    
    subgraph admin[Admin Dashboard]
        A1[Bot Setup page]
        A2[Profile Backfill section]
        A3[Click 'Backfill Profiles' button]
        A4[Shows success toast with stats]
        
        A1 --> A2 --> A3 --> A4
    end
    
    A3 -.-> I4
```

## Database Schema

```mermaid
erDiagram
    USERS ||--o{ MESSAGES : sends
    USERS ||--o{ COMMUNITY_MEMBERS : belongs_to
    USERS ||--o{ MAGIC_LINK_TOKENS : has
    
    USERS {
        uuid id PK
        uuid auth_user_id "Supabase auth link"
        text name
        text bio "Direct storage - no separate intros table!"
        text avatar_url
        text profile_picture_url
        bigint telegram_user_id
        text telegram_username
        boolean is_claimed "true after magic link claim"
        text[] interests_skills
        text headline
    }
    
    MESSAGES {
        uuid id PK
        uuid sender_id FK
        text content
        text topic_name "Filter: 'Intros'"
        uuid community_id FK
        timestamp created_at
    }
    
    COMMUNITY_MEMBERS {
        uuid user_id FK
        uuid community_id FK
    }
    
    MAGIC_LINK_TOKENS {
        uuid id PK
        text token "Unique auth token"
        uuid user_id FK
        uuid community_id FK
        timestamp expires_at "24 hours"
        boolean used
    }
```

## Key Features

- **Magic Link Auth**: Users click `/start` → get magic link → instantly authenticated on web app
- **Profile Page**: Clean, simple interface to edit name, bio, and profile photo
- **Direct Bio Storage**: Intros go straight into `users.bio` (no separate intro messages table)
- **Backfill Tool**: Admin button to import all existing intro messages from Telegram into profiles
- **Batch Processing**: Backfill processes all intros with 50ms delay between calls
- **Cross-Platform**: Same profile data accessible in Telegram bot and web app
- **Avatar Storage**: Profile photos stored in Supabase `avatars` bucket
