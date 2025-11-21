# Enhanced Roadmap Drag-and-Drop System

This diagram illustrates the complete enhanced roadmap system with newest-first sorting, drag-and-drop reordering, and Add Feature dialog.

```mermaid
graph TD
    A[User Opens Roadmap] --> B[Fetch Items]
    B --> C[Sort by created_at DESC]
    C --> D[Display Newest First]
    
    D --> E{User Action?}
    
    E -->|Add Feature| F[Click Add Feature Button]
    F --> G[Open Dialog]
    G --> H[Fill Form Fields]
    H --> I[Submit Form]
    I --> J[Insert with order_index: 0]
    J --> K[Invalidate Cache]
    K --> L[UI Refreshes]
    
    E -->|Drag Item| M[User Grabs Handle]
    M --> N[DndContext Captures Event]
    N --> O[User Drops Item]
    O --> P{Position Changed?}
    
    P -->|No| Q[Cancel - No Changes]
    P -->|Yes| R[Calculate New Indices]
    R --> S[arrayMove Reorders Array]
    S --> T[Optimistic UI Update]
    T --> U[Batch Update Database]
    U --> V[Update order_index for All]
    V --> K
    
    E -->|Edit Field| W[Click Field]
    W --> X[Inline Edit Mode]
    X --> Y[Save Changes]
    Y --> Z[Update Single Field]
    Z --> K
    
    style A fill:#e1f5ff
    style G fill:#fff4e1
    style T fill:#ffe1f5
    style L fill:#e7f5e1
```

## System Architecture

### Component Structure

```mermaid
graph LR
    A[InlineEditRoadmapView] --> B[AddFeatureDialog]
    A --> C[DndContext]
    C --> D[SortableContext]
    D --> E[SortableRoadmapItem]
    E --> F[GripVertical Handle]
    E --> G[Inline Edit Fields]
    E --> H[Vote Buttons]
    
    style A fill:#e1f5ff
    style B fill:#fff4e1
    style E fill:#ffe1f5
```

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Dialog
    participant DnD as DndContext
    participant Cache as React Query
    participant DB as Supabase
    
    Note over User,DB: Add Feature Flow
    User->>UI: Click "Add Feature"
    UI->>Dialog: Open Dialog
    User->>Dialog: Fill form & submit
    Dialog->>DB: INSERT with order_index: 0
    DB-->>Cache: Success
    Cache->>UI: Invalidate & refetch
    UI->>User: Show new item at top
    
    Note over User,DB: Drag-and-Drop Flow
    User->>UI: Drag item by handle
    UI->>DnD: onDragStart
    User->>UI: Drop at new position
    DnD->>DnD: Calculate new indices
    DnD->>Cache: Optimistic update
    DnD->>DB: Batch update order_index
    DB-->>Cache: Success
    Cache->>UI: Invalidate & refetch
    UI->>User: Show reordered list
    
    Note over User,DB: Inline Edit Flow
    User->>UI: Click field to edit
    UI->>UI: Show input
    User->>UI: Change value
    UI->>DB: UPDATE single field
    DB-->>Cache: Success
    Cache->>UI: Invalidate & refetch
    UI->>User: Show updated value
```

## Key Features

### 1. Newest-First Sorting
- **Primary Sort**: `created_at DESC` (newest items first)
- **Secondary Sort**: `order_index ASC` (respects manual reordering)
- New items always appear at top by default
- Manual drag-and-drop can override chronological order

### 2. Add Feature Dialog
- Professional dialog UI with form validation
- Required fields: Title, Description
- Optional fields: Status, Category, Priority, Timeline, Tags, Icon
- Auto-focus on title field
- Keyboard shortcuts: Enter to submit, Escape to cancel
- Insert with `order_index: 0` to appear at top

### 3. Drag-and-Drop Reordering
- **Library**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **Visual Handle**: `GripVertical` icon (opacity 30% → 100% on hover)
- **Sensors**: PointerSensor + KeyboardSensor
- **Collision Detection**: `closestCenter`
- **Strategy**: `verticalListSortingStrategy`
- **Feedback**: 50% opacity while dragging, smooth transitions

### 4. Inline Editing
- Click any field to edit in-place
- Auto-save on blur
- Keyboard shortcuts: Enter to save, Escape to cancel
- Fields: Title, Description, Status, Category, Timeline

### 5. Voting System
- Upvote/Downvote buttons with counts
- Optimistic UI updates
- Hover states for better UX

## Database Schema

```sql
-- product_roadmap table
CREATE TABLE product_roadmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  priority TEXT NOT NULL,
  category TEXT NOT NULL,
  estimated_timeline TEXT,
  icon TEXT,
  tags TEXT[],
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient sorting
CREATE INDEX idx_roadmap_created_at ON product_roadmap(created_at DESC);
CREATE INDEX idx_roadmap_order ON product_roadmap(order_index ASC);
```

## Reorder Algorithm

```typescript
// 1. Find old and new positions
const oldIndex = items.findIndex(i => i.id === active.id);
const newIndex = items.findIndex(i => i.id === over.id);

// 2. Reorder array using arrayMove utility
const reordered = arrayMove(items, oldIndex, newIndex);

// 3. Optimistic UI update (instant feedback)
queryClient.setQueryData(['roadmap-items'], reordered);

// 4. Batch update all items with new order_index
const updates = reordered.map((item, index) =>
  supabase
    .from('product_roadmap')
    .update({ order_index: index })
    .eq('id', item.id)
);
await Promise.all(updates);

// 5. Invalidate cache to sync with database
queryClient.invalidateQueries(['roadmap-items']);
```

## Visual States

| State | Opacity | Cursor | Transform |
|-------|---------|--------|-----------|
| Normal | 100% | default | none |
| Hover Handle | 100% | grab | none |
| Dragging Item | 50% | grabbing | scale(1.02) |
| Drop Target | 100% | default | highlight border |

## UX Improvements

✅ **Newest items appear at top** - Natural chronological order  
✅ **Drag-and-drop reordering** - Visual, intuitive interface  
✅ **Add Feature dialog** - Professional form with validation  
✅ **Inline editing** - Click-to-edit all fields  
✅ **Optimistic updates** - Instant UI feedback  
✅ **Visual drag handles** - Clear affordance for dragging  
✅ **Smooth transitions** - Polish and professional feel  
✅ **Keyboard shortcuts** - Power user efficiency  
✅ **Empty states** - Helpful guidance when no items  

## Performance Optimizations

1. **Optimistic Updates**: UI responds instantly before database confirms
2. **Batch Operations**: Single Promise.all() for all order_index updates
3. **Efficient Queries**: Uses database indexes for fast sorting
4. **Debounced Saves**: Inline edits save on blur, not on every keystroke
5. **Query Invalidation**: Only refetches affected queries

## Accessibility

- **Keyboard Navigation**: Full keyboard support for drag-and-drop
- **ARIA Labels**: Proper labels for drag handles and buttons
- **Focus Management**: Auto-focus in dialogs and inputs
- **Screen Reader Support**: Semantic HTML and ARIA attributes
- **Color Contrast**: All text meets WCAG AA standards

## Future Enhancements

🔮 **Possible additions** (not implemented yet):
- Bulk actions (multi-select + batch operations)
- Roadmap views (timeline, kanban, calendar)
- Filtering by tags, category, priority
- Search functionality
- Export to CSV/JSON
- Public vs. private roadmaps
- Comments and discussions per item
- File attachments
- Activity log/audit trail
