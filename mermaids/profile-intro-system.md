# Profile & Intro System Architecture

## Current Implementation (New Profile-Centric System)

```mermaid
graph LR
    subgraph "Telegram Auto-Claim Flow"
        TG1[Telegram User] -->|/start| TW1[telegram-webhook]
        TW1 -->|provision user| PTU1[provision-telegram-user]
        PTU1 -->|create/update| U1[(users table)]
        U1 -->|is_claimed=true| U1
        U1 -->|auth_user_id=generated| U1
        PTU1 -->|add to| CM1[(community_members)]
    end
    
    subgraph "Intro Generation & Storage"
        TG2[User in #intros] -->|sends message| TW2[telegram-webhook]
        TW2 -->|detects intro channel| GI[generate-intro]
        GI -->|calls| LAI[Lovable AI Gateway]
        LAI -->|returns intro text| GI
        GI -->|saves to| U2[(users.bio field)]
        U2 -.->|linked by| U2TG[telegram_user_id]
    end
    
    subgraph "Web Login & Profile Management"
        WU[Web User] -->|login/claim| AUTH[Supabase Auth]
        AUTH -->|auth_user_id| U3[(users table)]
        U3 -->|view/edit| PROF[Profile Page]
        PROF -->|update intro/bio| U3
    end
    
    subgraph "Conversations Tab Testing"
        ADMIN[Admin] -->|views| CONV[Conversations Tab]
        CONV -->|displays messages| MSG[(messages)]
        MSG -->|"Generate Intro" button| GI2[generate-intro]
        GI2 -->|saves to| U4[(users.bio)]
        CONV -->|"View Profile" button| VP[UserProfile Page]
        VP -->|shows bio| U4
    end
    
    style U1 fill:#4ade80
    style U2 fill:#4ade80
    style U3 fill:#4ade80
    style U4 fill:#4ade80
    style PTU1 fill:#60a5fa
    style GI fill:#60a5fa
    style GI2 fill:#60a5fa
```

## Database Schema Changes

```mermaid
erDiagram
    USERS {
        uuid id PK
        uuid auth_user_id FK
        bigint telegram_user_id UK
        text telegram_username
        text name
        text bio "Generated intro + custom bio"
        boolean is_claimed "Auto true on /start"
        timestamp created_at
    }
    
    MESSAGES {
        uuid id PK
        uuid sender_id FK
        text content
        text conversation_id
        text topic_name "e.g. 'intros'"
        jsonb metadata
    }
    
    COMMUNITY_MEMBERS {
        uuid id PK
        uuid user_id FK
        uuid community_id FK
        text role
    }
    
    USERS ||--o{ MESSAGES : sends
    USERS ||--o{ COMMUNITY_MEMBERS : belongs_to
```

## Key Features

1. **Auto-Claiming**: `/start` command automatically creates claimed profile with generated auth credentials
2. **Intro Storage**: Intros stored directly on `users.bio` field (not in memories table)
3. **Testing UI**: Conversations tab has "Generate Intro" button + "View Profile" link
4. **Cross-Platform**: Same profile works across Telegram, web apps, and external integrations
