# Custom Tools Dream Flow Architecture

This diagram shows the complete flow for adding custom tools to the bot using AI-generated API specifications.

```mermaid
graph TD
    A[User clicks Add Custom Tool] --> B[Dialog: Describe Tool Purpose]
    B --> C[User inputs: What should this tool do?]
    C --> D[AI generates detailed API prompt]
    D --> E[Show copyable prompt to user]
    E --> F{User takes prompt to another app}
    F --> G[Build API in external app]
    F --> H[Build API in Lovable app]
    F --> I[Use Make.com/Zapier]
    G --> J[User gets API endpoint details]
    H --> J
    I --> J
    J --> K[User pastes API details back]
    K --> L[Form: API URL, Auth Token, Parameters]
    L --> M[Save to custom_tools table]
    M --> N[Tool available in agent settings]
    N --> O[telegram-agent loads custom tools]
    O --> P[AI decides when to use tool]
    P --> Q[Agent makes HTTP POST to API]
    Q --> R[Response integrated into conversation]
    
    style D fill:#4CAF50
    style E fill:#2196F3
    style M fill:#FF9800
    style Q fill:#9C27B0
```

## Flow Breakdown

### Phase 1: Tool Definition (Steps A-D)
- User describes what they want the tool to do in natural language
- AI generates a comprehensive specification prompt
- Includes API design, request/response format, authentication

### Phase 2: External Implementation (Steps E-J)
- User takes the AI-generated prompt to any platform
- Options: Lovable app, external API, Make.com, Zapier, custom server
- User builds or configures the API endpoint

### Phase 3: Integration (Steps K-N)
- User returns with API details (URL, auth, parameters)
- Tool is saved to `custom_tools` table
- Becomes available in workflow builder

### Phase 4: Runtime Execution (Steps O-R)
- telegram-agent dynamically loads custom tools
- AI agent decides when to call the tool based on context
- HTTP POST request made with parameters
- Response integrated into conversation naturally

## Database Schema

```sql
custom_tools:
- id (uuid)
- community_id (uuid)
- name (text) - snake_case identifier
- display_name (text) - Human readable
- description (text) - What the tool does
- endpoint_url (text) - API endpoint
- http_method (text) - POST/GET/etc
- auth_type (text) - bearer/none/basic
- auth_value (text) - Token/key
- parameters (jsonb) - Parameter schema
- request_template (jsonb) - How to format requests
- is_enabled (boolean)
```

## Key Features

1. **AI-Powered Spec Generation**: Users don't need API knowledge
2. **Platform Agnostic**: Works with any HTTP endpoint
3. **Dynamic Loading**: Tools are loaded at runtime
4. **Smart Invocation**: AI agent decides when to use tools
5. **Error Handling**: Logs and tracks tool failures
