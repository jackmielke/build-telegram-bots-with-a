# Simplified Bot Onboarding Flow

```mermaid
graph TD
    A[Start: User clicks Create Bot] --> B[Step 1: Enter Telegram Bot Token]
    B --> C[Creating Bot...]
    C --> D[Step 2: Success Screen]
    D --> E[Step 3: Set Personality - System Prompt]
    E --> F[Step 4: Configure Tools]
    
    F --> G{Add Tools?}
    G -->|Default Enabled| H[✓ Search Memory]
    G -->|Default Enabled| I[✓ Add Memory]
    G -->|User Can Enable| J[Web Search]
    G -->|User Can Add| K[Custom Tools...]
    
    H --> L[Step 5: Tokenization Optional]
    I --> L
    J --> L
    K --> L
    
    L --> M{Tokenize Bot?}
    M -->|Yes| N[Token Launch Flow]
    M -->|No| O[Complete Setup]
    
    N --> O
    O --> P[Navigate to Bot Dashboard]
    
    style A fill:#e1f5ff
    style B fill:#fff4e1
    style E fill:#ffe1f5
    style F fill:#e1ffe1
    style L fill:#f5e1ff
    style P fill:#90EE90
```

## Flow Details

### Step 1: Enter Bot Token
- User pastes Telegram bot token from BotFather
- System validates token and fetches bot info

### Step 2: Success Screen
- Shows bot avatar, name, username
- Quick confirmation before configuration

### Step 3: Set Personality
- Single textarea for system prompt
- "Improve Prompt" AI assistance button
- Keep it simple - just the core personality

### Step 4: Configure Tools
- Dropdown/checklist interface
- **Default enabled:**
  - Search Memory (search through saved conversations)
  - Add Memory (save new information)
- **Optional:**
  - Web Search
  - Custom tools (if any exist)

### Step 5: Tokenization (Optional)
- "Would you like to tokenize this bot?"
- If yes → Launch token flow (existing TokenLaunchDialog)
- If no → Skip to dashboard

### Simplified Approach
- Remove: Intro message configuration (can be set later in settings)
- Remove: Message type toggles (DMs/Groups) - default to DMs only, configure later
- Remove: Memory chunks setup - too complex for onboarding
- Focus: Get bot running with minimal configuration, refine later
