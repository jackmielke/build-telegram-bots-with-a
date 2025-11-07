# Token Launch Implementation

## Overview
This diagram shows the complete implementation of the Long.xyz token launch workflow integrated into the BotBuilder platform.

```mermaid
graph TD
    A[User Opens Bot Settings] --> B[Token Management Section]
    B --> C{Tokens Exist?}
    
    C -->|No| D[Empty State: Launch First Token]
    C -->|Yes| E[Display Token Cards]
    
    D --> F[Click Launch Token]
    E --> F
    
    F --> G[Token Launch Dialog Opens]
    G --> H[User Fills Form]
    
    H --> H1[Token Name]
    H --> H2[Token Symbol]
    H --> H3[Description Optional]
    H --> H4[Wallet Address Required]
    H --> H5[Upload Image or Use Cover]
    
    H1 --> I[Submit Form]
    H2 --> I
    H3 --> I
    H4 --> I
    H5 --> I
    
    I --> J[launch-token Edge Function]
    
    J --> K[Step 1: Upload Image to IPFS]
    K --> K1[POST /ipfs/upload-image]
    K1 --> K2[Convert image to blob]
    K2 --> K3[Receive image_hash]
    
    K3 --> L[Step 2: Upload Metadata]
    L --> L1[POST /ipfs/upload-metadata]
    L1 --> L2[Include: name, description,<br/>image_hash, social_links]
    L2 --> L3[Receive metadata_hash]
    
    L3 --> M[Step 3: Encode Template]
    M --> M1[POST /auction-templates]
    M1 --> M2[templateId: fecbd0f1-7a92-4671]
    M2 --> M3[chainId: 8453 Base]
    M3 --> M4[token_uri: ipfs://metadata_hash]
    M4 --> M5[Receive encoded_payload]
    
    M5 --> N[Step 4: Broadcast Sponsored]
    N --> N1[POST /sponsorship]
    N1 --> N2[Platform pays gas!]
    N2 --> N3[Receive transaction_hash]
    
    N3 --> O[Step 5: Store in Database]
    O --> O1[Insert into bot_tokens table]
    O1 --> O2[Include all token details]
    
    O2 --> P[Success! 🎉]
    P --> P1[Show transaction link]
    P --> P2[Display in Token Management]
    P --> P3[Refresh token list]
    
    style K fill:#e3f2fd
    style L fill:#f3e5f5
    style M fill:#fff3e0
    style N fill:#e8f5e9
    style O fill:#ffecb3
    style P fill:#c8e6c9
```

## Component Architecture

```mermaid
graph LR
    A[CommunitySettings] --> B[TokenManagement]
    B --> C[TokenLaunchDialog]
    B --> D[Token Cards Display]
    
    C --> E[Form: React Hook Form]
    C --> F[Image Upload/Preview]
    C --> G[Progress Indicator]
    
    E --> H[Submit to Edge Function]
    
    H --> I[launch-token Function]
    I --> J[Long.xyz API]
    I --> K[Supabase DB]
    
    J --> J1[IPFS Image Upload]
    J --> J2[IPFS Metadata Upload]
    J --> J3[Template Encoding]
    J --> J4[Sponsored Broadcast]
    
    K --> K1[bot_tokens table]
    K1 --> L[RLS Policies]
    
    style B fill:#e3f2fd
    style C fill:#f3e5f5
    style I fill:#fff3e0
    style J fill:#e8f5e9
```

## Database Schema

```mermaid
erDiagram
    bot_tokens {
        uuid id PK
        uuid community_id FK
        text token_name
        text token_symbol
        text token_description
        text token_address
        text hook_address
        text transaction_hash
        text image_ipfs_hash
        text metadata_ipfs_hash
        integer chain_id
        text template_id
        text initial_supply
        text num_tokens_to_sell
        jsonb launch_metadata
        uuid created_by FK
        timestamp created_at
        timestamp updated_at
    }
    
    communities {
        uuid id PK
        text name
        text cover_image_url
    }
    
    users {
        uuid id PK
        uuid auth_user_id
        text name
    }
    
    communities ||--o{ bot_tokens : has
    users ||--o{ bot_tokens : creates
```

## API Flow Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant UI as TokenLaunchDialog
    participant EF as launch-token Function
    participant LONG as Long.xyz API
    participant DB as Supabase DB
    participant BC as Base Blockchain
    
    U->>UI: Fill token details
    U->>UI: Upload/select image
    U->>UI: Click Launch Token
    
    UI->>EF: Invoke with token data
    
    Note over EF: Authenticate user
    EF->>DB: Get user ID
    DB-->>EF: User data
    
    Note over EF,LONG: Step 1: Image Upload
    EF->>EF: Convert image to blob
    EF->>LONG: POST /ipfs/upload-image
    LONG-->>EF: image_hash
    
    Note over EF,LONG: Step 2: Metadata Upload
    EF->>LONG: POST /ipfs/upload-metadata<br/>(name, desc, image_hash)
    LONG-->>EF: metadata_hash
    
    Note over EF,LONG: Step 3: Encode Template
    EF->>LONG: POST /auction-templates<br/>(templateId, metadata)
    LONG-->>EF: encoded_payload, token_address
    
    Note over EF,LONG: Step 4: Sponsored Broadcast
    EF->>LONG: POST /sponsorship<br/>(encoded_payload)
    Note over LONG: Platform pays gas
    LONG->>BC: Broadcast transaction
    BC-->>LONG: transaction_hash
    LONG-->>EF: transaction_hash
    
    Note over EF,DB: Step 5: Store Token
    EF->>DB: INSERT into bot_tokens
    DB-->>EF: Token record
    
    EF-->>UI: Success + transaction_hash
    UI-->>U: Show success + BaseScan link
    
    U->>UI: Click View on BaseScan
    UI->>BC: Open transaction explorer
```

## Key Features Implemented

### 1. Token Launch Dialog
- **Form validation** using React Hook Form + Zod
- **Image upload/preview** with fallback to community cover
- **Live progress** indicator during 4-step process
- **Transaction link** to BaseScan for verification
- **Auto-refresh** token list on success

### 2. Token Management Dashboard
- **Token cards** displaying all launched tokens
- **IPFS image** display from hash
- **Token metadata** (name, symbol, address, chain)
- **BaseScan links** for each token transaction
- **Empty state** encouraging first token launch

### 3. Edge Function (launch-token)
- **Authentication** via Supabase Auth
- **4-step API calls** to Long.xyz
- **Image conversion** from URL/base64 to blob
- **Error handling** with detailed logging
- **Database storage** of all token details
- **RLS compliance** for security

### 4. Database Structure
- **bot_tokens table** with comprehensive fields
- **RLS policies** ensuring only admins can create/modify
- **Foreign keys** to communities and users
- **Indexes** on community_id and token_address
- **Auto-updated** updated_at timestamp

### 5. API Configuration
- **LONG_API_KEY** secret stored securely
- **Template ID** hardcoded: `fecbd0f1-7a92-4671-9be6-30d5a14571e5`
- **Chain ID** default: `8453` (Base)
- **Gasless transactions** via sponsorship endpoint

## Integration Points

### Where to Add Token Management

Add `TokenManagement` component to your community settings:

```typescript
// In CommunitySettings.tsx or similar
import { TokenManagement } from "./TokenManagement";

// Inside your settings page
<TokenManagement 
  communityId={communityId}
  communityName={community.name}
  coverImageUrl={community.cover_image_url}
/>
```

### Environment Variables Required

```bash
LONG_API_KEY=7N1MiAaBNZ0cgEnJjtRHrON4dPC0Evrr
```

## Testing Checklist

- [ ] Upload new image works
- [ ] Use community cover works
- [ ] Form validation catches errors
- [ ] Progress indicator updates correctly
- [ ] Transaction hash is valid
- [ ] Token appears in management list
- [ ] BaseScan link opens correctly
- [ ] RLS policies prevent unauthorized access
- [ ] Multiple tokens per community work
- [ ] Error handling shows meaningful messages

## Future Enhancements

1. **Token Analytics**
   - Holder count tracking
   - Price history charts
   - Volume metrics

2. **Token-Gated Features**
   - Require X tokens to access bot features
   - Token balance checks in custom tools

3. **Advanced Tokenomics**
   - Custom vesting schedules
   - Multiple beneficiaries
   - Token burning mechanics

4. **Social Features**
   - Token transfer within community
   - Leaderboards by token holdings
   - Token-based rewards system
