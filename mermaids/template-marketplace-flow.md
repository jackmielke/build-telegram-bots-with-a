# Template Marketplace Flow

## User Journey Through Template Marketplace

```mermaid
graph TD
    A[User Visits /templates] --> B[Browse Templates Page]
    B --> C{Filter Templates}
    
    C --> D[Search by Keywords]
    C --> E[Filter by Category]
    C --> F[View Featured]
    C --> G[View All]
    
    D --> H[Filtered Results]
    E --> H
    F --> H
    G --> H
    
    H --> I[Click Template Card]
    I --> J[Deploy Dialog Opens]
    
    J --> K[Step 1: Select Community]
    K --> L{Has Admin Communities?}
    
    L -->|No| M[Redirect to Communities]
    L -->|Yes| N[Choose Community]
    
    N --> O[Step 2: Customize Bot]
    O --> P[Set Bot Name]
    O --> Q[Custom Instructions Optional]
    
    P --> R[Deploy Template]
    Q --> R
    
    R --> S[Update Community Config]
    S --> T[Increment Use Count]
    T --> U[Step 3: Success]
    
    U --> V[Go to Dashboard]
    U --> W[Deploy Another]
```

## Template Deployment Process

```mermaid
sequenceDiagram
    participant User
    participant UI as Marketplace UI
    participant DB as Supabase DB
    participant Community as Community Record
    
    User->>UI: Browse templates
    UI->>DB: Fetch bot_templates
    DB-->>UI: Return templates list
    
    User->>UI: Click "Deploy Template"
    UI->>DB: Fetch user's admin communities
    DB-->>UI: Return community list
    
    User->>UI: Select community & customize
    UI->>DB: Update community config
    Note over DB: Updates agent_name, instructions,<br/>temperature, max_tokens, etc.
    
    DB-->>UI: Config updated
    UI->>DB: Increment template use_count
    DB-->>UI: Count incremented
    
    UI-->>User: Success! Template deployed
    User->>UI: Navigate to dashboard
```

## Template Data Structure

```mermaid
erDiagram
    BOT_TEMPLATES ||--o{ COMMUNITIES : "deployed to"
    
    BOT_TEMPLATES {
        uuid id PK
        text name
        text description
        text long_description
        text category
        text[] tags
        text thumbnail_url
        boolean is_featured
        int use_count
        text difficulty_level
        int estimated_setup_time
        jsonb template_config
        text[] example_interactions
        uuid created_by FK
    }
    
    COMMUNITIES {
        uuid id PK
        text agent_name
        text agent_instructions
        numeric agent_temperature
        int agent_max_tokens
        text[] agent_suggested_messages
        boolean daily_message_enabled
    }
    
    USERS {
        uuid id PK
        uuid auth_user_id
        text name
    }
    
    BOT_TEMPLATES }o--|| USERS : "created by"
```

## Template Configuration Merge

```mermaid
graph LR
    A[Template Config] --> C[Merged Config]
    B[User Customizations] --> C
    
    C --> D[agent_name]
    C --> E[agent_instructions]
    C --> F[agent_temperature]
    C --> G[agent_max_tokens]
    C --> H[agent_suggested_messages]
    C --> I[daily_message_enabled]
    C --> J[daily_message_time]
    C --> K[daily_message_content]
    
    D --> L[Update Community]
    E --> L
    F --> L
    G --> L
    H --> L
    I --> L
    J --> L
    K --> L
```

## Key Features

### Template Categories
- **Community**: Community management, FAQs, welcome bots
- **Productivity**: Stand-ups, task management, reminders
- **Education**: Learning companions, study groups
- **Entertainment**: Content curation, games
- **Business**: Customer support, sales
- **Support**: Help desk, troubleshooting
- **Custom**: Specialized use cases

### Template Attributes
- **Difficulty Level**: Beginner, Intermediate, Advanced
- **Estimated Setup Time**: Minutes to configure
- **Use Count**: Popularity metric
- **Featured Status**: Highlighted templates
- **Tags**: Searchable keywords
- **Example Interactions**: Sample conversations

### Deployment Flow
1. **Browse**: Search and filter templates
2. **Preview**: View details and examples
3. **Select**: Choose target community
4. **Customize**: Set bot name and instructions
5. **Deploy**: Apply configuration
6. **Manage**: Access from dashboard

### Security
- Only community admins can deploy templates
- RLS policies enforce user permissions
- Template configs validated before deployment
- Use count tracking for analytics

## Sample Templates Included

1. **Community Assistant** (Featured)
   - Welcome new members
   - Answer FAQs
   - Facilitate introductions

2. **Daily Stand-up Bot** (Featured)
   - Automated check-ins
   - Team updates compilation
   - Async workflows

3. **Event Coordinator** (Featured)
   - RSVP management
   - Event reminders
   - Q&A handling

4. **Learning Companion**
   - Resource sharing
   - Progress tracking
   - Peer learning

5. **Customer Support Bot**
   - 24/7 availability
   - Issue troubleshooting
   - Ticket escalation

6. **Content Curator**
   - Content discovery
   - Discussion facilitation
   - Recommendations
