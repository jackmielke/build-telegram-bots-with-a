# Simplified Custom Tools Flow

## Overview
This diagram shows the streamlined custom tools interface that makes it easy for users to connect external APIs to their bot.

```mermaid
graph TD
    A[Bot Settings Page] --> B[Advanced Tool Settings Section]
    B --> C{Custom Tools Toggle}
    
    C -->|Toggle ON| D[Show Custom Tools List]
    C -->|Toggle OFF| E[Hide Custom Tools]
    
    D --> F{Any Tools Exist?}
    
    F -->|No| G[Empty State Card]
    F -->|Yes| H[Display Tool Cards]
    
    G --> I[Add Your First Tool Button]
    H --> J[Tool Management Actions]
    
    J --> J1[Test Tool]
    J --> J2[Edit Tool]
    J --> J3[Delete Tool]
    J --> J4[Enable/Disable Toggle]
    
    I --> K[Simplified Add Tool Dialog]
    J2 --> K
    
    K --> L[3-Step Form]
    
    L --> L1[Step 1: Tool Name]
    L --> L2[Step 2: API Details<br/>URL + Auth Token]
    L --> L3[Step 3: Parameters<br/>Name + Description]
    
    L1 --> M[Pro Tip Alert]
    M --> N[Guides users to prompt AI builder<br/>for API details]
    
    L3 --> O[Add Parameter Button]
    O --> P[Dynamic Parameter Cards]
    
    P --> Q[Save Tool]
    Q --> R[Tool Available in Bot]
    
    J1 --> S[Test Tool Dialog]
    S --> T[Input Test Data]
    T --> U[Execute API Call]
    U --> V[Show Results]
    
    R --> W[telegram-agent Function]
    W --> X[Load Custom Tools from DB]
    X --> Y[Merge with Built-in Tools]
    Y --> Z[AI Can Use Custom Tool]
    
    style K fill:#e3f2fd
    style M fill:#fff3e0
    style L fill:#f3e5f5
    style R fill:#e8f5e9
```

## Key Features

### 1. Toggle Interface
- Located in Advanced Tool Settings
- Shows/hides custom tools section
- Clean and non-intrusive

### 2. Simplified Form (3 Steps)
1. **Tool Name**: Simple display name
2. **API Details**: 
   - Endpoint URL
   - Optional auth token (bearer or API key)
3. **Parameters**: 
   - Dynamic list of key-value pairs
   - Each parameter has name + description

### 3. Pro Tip Guidance
Alert box provides exact prompt for users to ask their AI builder:
> "I want to connect [API name] to my bot. Give me: 1) The API endpoint URL, 2) The auth token/API key, 3) All required parameters with descriptions"

### 4. Auto-Configuration
- Automatically sets HTTP method to POST
- Automatically creates request template from parameters
- Uses bearer token auth if provided, otherwise no auth
- All parameters marked as required by default

### 5. Tool Management
Each tool card shows:
- Tool name and parameter count
- Last used timestamp
- Quick actions: Test, Edit, Delete, Enable/Disable

## Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Custom Tools UI
    participant DB as Supabase DB
    participant TG as telegram-agent
    participant API as External API
    
    U->>UI: Enable Custom Tools Toggle
    UI->>DB: Query custom_tools table
    DB-->>UI: Return tools list
    UI-->>U: Display tools
    
    U->>UI: Click "Add Tool"
    UI-->>U: Show simplified form
    
    U->>UI: Fill in tool details
    U->>UI: Click "Save Tool"
    
    UI->>DB: Insert tool to custom_tools
    DB-->>UI: Confirm saved
    UI-->>U: Success message
    
    Note over TG: When bot receives message
    TG->>DB: Load custom tools
    DB-->>TG: Return enabled tools
    TG->>TG: Merge with built-in tools
    TG->>TG: AI decides to use custom tool
    
    TG->>API: Execute HTTP request
    API-->>TG: Return response
    TG-->>U: Send result to user
```

## Benefits

1. **Simplicity**: Only 3 required fields (name, URL, parameters)
2. **Guidance**: Pro tip tells users exactly what to ask their AI builder
3. **Flexibility**: Works with any API that accepts JSON
4. **Testing**: Built-in test dialog for verification
5. **Non-invasive**: Toggle keeps advanced features optional
