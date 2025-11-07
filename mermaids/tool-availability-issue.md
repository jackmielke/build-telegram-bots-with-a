# Tool Availability Issue & Solution

## Current Problem

The bot is confused about which tools it can use because of a mismatch between custom tools and built-in tools in the security check.

```mermaid
graph TD
    A[User Toggles Tool in UI] --> B{Tool Type?}
    
    B -->|Built-in Tool| C[Update workflows.configuration.agent_tools]
    B -->|Custom Tool| D[Update custom_tools.is_enabled]
    
    C --> E[telegram-webhook reads agent_tools]
    D --> F[telegram-agent reads custom_tools]
    
    E --> G[Pass enabledTools object to telegram-agent]
    F --> H[Load custom tools with is_enabled=true]
    
    G --> I[Filter AGENT_TOOLS by enabledTools]
    H --> J[Already filtered custom tools]
    
    I --> K[Merge into availableTools array]
    J --> K
    
    K --> L[AI receives full tool list]
    L --> M{AI decides to use tool}
    
    M --> N[SECURITY CHECK]
    N --> O{Is tool in enabledTools object?}
    
    O -->|Yes - Built-in| P[✅ Execute tool]
    O -->|No - Custom| Q[❌ BLOCKED! Error message]
    
    Q --> R[Bot confused - thinks it has tool but can't use it]
    
    style Q fill:#ff6b6b
    style R fill:#ff6b6b
    style P fill:#51cf66
```

## The Bug

**Location:** `supabase/functions/telegram-agent/index.ts` lines 998-1007

```typescript
// SECURITY CHECK: Verify tool is actually enabled
if (!enabledTools || !enabledTools[toolName]) {
  console.error(`⚠️ Tool ${toolName} was called but is not enabled`);
  // Block execution
}
```

**Problem:** This checks if `enabledTools[toolName]` exists, but:
- `enabledTools` only contains **built-in** tool toggles (web_search, search_memory, etc.)
- **Custom tools** aren't in this object - they're filtered separately by `is_enabled` in the database
- So custom tools that ARE enabled get blocked by this check!

## The Solution

Update the security check to handle both built-in and custom tools:

```mermaid
graph TD
    A[Tool Call Attempt] --> B{Is tool custom?}
    
    B -->|Yes - has _custom flag| C{Was it in availableTools list?}
    B -->|No - built-in| D{Is it in enabledTools object?}
    
    C -->|Yes| E[✅ Allow - already filtered by is_enabled]
    C -->|No| F[❌ Block - not enabled]
    
    D -->|Yes & true| E
    D -->|No or false| F
    
    E --> G[Execute Tool]
    F --> H[Return error to AI]
    
    style E fill:#51cf66
    style F fill:#ff6b6b
    style G fill:#51cf66
    style H fill:#ff6b6b
```

## Implementation

We need to:
1. Track which tools are actually available (from the filtered list)
2. Check against the available tools list instead of just the enabledTools object
3. Custom tools that passed the `is_enabled=true` filter are automatically authorized

```typescript
// Build a Set of actually available tool names for security checks
const availableToolNames = new Set(availableTools.map(t => t.function.name));

// Later in security check:
if (!availableToolNames.has(toolName)) {
  // Tool not in available list - blocked
}
```

## Why This Matters

Without this fix:
- Bot receives tool definitions (sees them in its context)
- Bot tries to use the tools
- Security check blocks execution
- Bot gets confused error messages
- User sees inconsistent behavior

With the fix:
- Only truly enabled tools reach the bot
- Security check validates against actual available tools
- Custom tools work seamlessly
- Consistent, predictable behavior
