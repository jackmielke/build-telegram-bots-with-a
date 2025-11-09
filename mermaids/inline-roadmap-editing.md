# Inline Roadmap Editing System

## Overview
The inline editing system provides a Notion-like experience for editing roadmap items directly without dialogs or complex workflows.

## System Architecture

```mermaid
graph TB
    subgraph "View Layer"
        A[InlineEditRoadmapView] --> B[Roadmap Items List]
        B --> C[Individual Item Card]
    end
    
    subgraph "Interaction Flow"
        C --> D{User Action}
        D -->|Hover| E[Show Edit Indicators]
        D -->|Click Field| F[Enter Edit Mode]
        D -->|Hover Delete| G[Show Delete Button]
    end
    
    subgraph "Edit Mode"
        F --> H{Field Type}
        H -->|Text| I[Text Input]
        H -->|Textarea| J[Textarea]
        H -->|Select| K[Dropdown]
        I --> L[Auto-save on Blur]
        J --> L
        K --> L
    end
    
    subgraph "State Management"
        L --> M[Update Mutation]
        M --> N[Supabase Update]
        N --> O[Invalidate Query]
        O --> P[Refresh UI]
        P --> B
    end
    
    subgraph "CRUD Operations"
        Q[Add Button] --> R[Insert New Item]
        G --> S[Delete Mutation]
        R --> N
        S --> N
    end
    
    style A fill:#a78bfa,stroke:#7c3aed,color:#fff
    style N fill:#3b82f6,stroke:#2563eb,color:#fff
    style F fill:#22c55e,stroke:#16a34a,color:#fff
```

## Interaction Patterns

```mermaid
sequenceDiagram
    actor User
    participant UI as Item Card
    participant State as Edit State
    participant DB as Supabase
    participant Cache as React Query

    User->>UI: Hover over field
    UI->>UI: Show edit highlight
    
    User->>UI: Click field
    UI->>State: Set editing mode
    State->>UI: Render input field
    
    User->>UI: Type changes
    UI->>State: Update temp value
    
    User->>UI: Blur (click away)
    UI->>State: Trigger save
    State->>DB: Update mutation
    DB-->>State: Success
    State->>Cache: Invalidate query
    Cache->>DB: Refetch data
    DB-->>UI: Fresh data
    UI->>User: Show updated value
```

## Editable Fields

```mermaid
mindmap
  root((Roadmap Item))
    Title
      Text input
      Large font
      Primary field
    Description
      Textarea
      Multiline
      Secondary field
    Status
      Dropdown
      5 options
      Badge display
    Priority
      Dropdown
      4 levels
      Badge display
    Category
      Dropdown
      8 categories
      Badge display
    Timeline
      Text input
      Short field
      Inline display
    Tags
      Text input
      Comma-separated
      Badge array
```

## Data Flow

```mermaid
flowchart LR
    A[User Edit] --> B{Validation}
    B -->|Valid| C[Temp State]
    B -->|Invalid| D[Error Toast]
    C --> E[Blur Event]
    E --> F[Update Mutation]
    F --> G{Success?}
    G -->|Yes| H[Invalidate Cache]
    G -->|No| I[Error Toast]
    H --> J[Refetch Data]
    J --> K[UI Update]
    
    style A fill:#a78bfa,stroke:#7c3aed,color:#fff
    style F fill:#3b82f6,stroke:#2563eb,color:#fff
    style K fill:#22c55e,stroke:#16a34a,color:#fff
    style D fill:#ef4444,stroke:#dc2626,color:#fff
    style I fill:#ef4444,stroke:#dc2626,color:#fff
```

## Key Features

### 1. Hover Interactions
- **Field Highlighting**: Subtle background change on hover
- **Delete Button**: Appears on card hover (top-right)
- **Visual Feedback**: Cursor changes to indicate editability

### 2. Edit Modes
- **Text Fields**: Single-line input for title, timeline
- **Text Areas**: Multi-line for descriptions
- **Dropdowns**: Pre-defined options for status, priority, category
- **Tag Input**: Comma-separated values parsed to array

### 3. Save Behavior
- **Auto-save**: On blur (clicking away)
- **Keyboard Shortcuts**: 
  - `Enter` saves (for text inputs)
  - `Escape` cancels
- **No Manual Save Button**: Seamless UX

### 4. State Management
- **Optimistic Updates**: UI updates immediately
- **Cache Invalidation**: React Query refetches on change
- **Toast Notifications**: Success/error feedback

## View Modes Comparison

| Feature | Inline Edit | Grid View | List View |
|---------|------------|-----------|-----------|
| Default View | ✅ | ❌ | ❌ |
| Inline Editing | ✅ | ❌ | ✅ |
| Visual Cards | ✅ | ✅ | ❌ |
| Drag & Drop | ❌ | ❌ | ✅ |
| Compact Display | ✅ | ❌ | ✅ |
| Quick CRUD | ✅ | ❌ | ✅ |

## Technical Implementation

### State Structure
```typescript
editingField: { 
  id: string;      // Item ID being edited
  field: string;   // Field name being edited
} | null

tempValue: string  // Temporary value during editing
```

### Mutation Flow
1. User clicks field → Enter edit mode
2. User types → Update temp state
3. User blurs → Trigger mutation
4. Mutation → Update Supabase
5. Success → Invalidate cache
6. Cache → Refetch data
7. UI → Show fresh data

### Database Schema
- All updates use the `product_roadmap` table
- RLS policies require admin role for modifications
- Order preserved via `order_index` field
