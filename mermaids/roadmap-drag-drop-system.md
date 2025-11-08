# Roadmap Drag-and-Drop System

This diagram illustrates the drag-and-drop reordering system for roadmap items.

```mermaid
graph TD
    A[User Drags Item] --> B[DndContext Captures Event]
    B --> C{Dropped on<br/>Different Position?}
    
    C -->|No| D[Cancel - No Changes]
    C -->|Yes| E[Calculate New Order]
    
    E --> F[arrayMove Reorders Array]
    F --> G[Update Local Cache]
    G --> H[Batch Update Database]
    
    H --> I[Update order_index<br/>for All Items]
    I --> J[Invalidate Queries]
    J --> K[UI Refreshes]
    
    L[SortableItem Component] --> M[GripVertical Handle]
    M --> N[Drag Listeners]
    N --> B
    
    O[Transform & Transition] --> P[Visual Feedback]
    P --> Q[isDragging State]
    Q --> R[Opacity: 0.5]
    
    style A fill:#e1f5ff
    style H fill:#fff4e1
    style K fill:#e7f5e1
    style M fill:#ffe1f5
```

## Key Components

### DndContext
- Manages drag and drop state
- Uses `PointerSensor` and `KeyboardSensor`
- Collision detection: `closestCenter`
- Triggers `onDragEnd` event

### SortableContext
- Wraps sortable items
- Uses `verticalListSortingStrategy`
- Maintains item order

### SortableItem
- Individual draggable component
- Has `GripVertical` handle for dragging
- Shows visual feedback during drag
- Transforms position smoothly

## Data Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant DnD as DndContext
    participant Cache as React Query
    participant DB as Supabase
    
    User->>UI: Drag Item from position A
    UI->>DnD: Start drag
    User->>UI: Drop at position B
    DnD->>DnD: Calculate new indices
    DnD->>Cache: Update local state (optimistic)
    DnD->>DB: Batch update order_index
    DB-->>Cache: Success
    Cache->>UI: Invalidate & refetch
    UI->>User: Show reordered list
```

## Reorder Logic

1. **Find Positions**: Locate old and new index
2. **Array Move**: Use `arrayMove` utility from dnd-kit
3. **Optimistic Update**: Immediately update cache
4. **Batch DB Update**: Update all affected items' `order_index`
5. **Refresh**: Invalidate queries to sync state

## Visual States

- **Normal**: Full opacity, cursor-grab
- **Dragging**: 50% opacity, cursor-grabbing
- **Hover**: Accent background on handle
- **Transition**: Smooth CSS transform

## Database Schema

```sql
order_index: integer
-- Sequential index starting from 0
-- Determines display order
-- Updated in batch after reordering
```
