# Members fetch chunking flow

This diagram documents the improved flow for loading community members, avoiding long URL/timeouts by chunking ID lists.

<lov-mermaid>
sequenceDiagram
  participant UI as MembersManagement (UI)
  participant EF as list-community-members (Edge Function)
  participant DB as Supabase DB

  UI->>EF: invoke with communityId
  EF->>DB: select community_members by community_id
  EF->>DB: for each 100 IDs chunk, select users in(id_chunk)
  EF->>DB: select telegram_chat_sessions by community_id
  EF-->>UI: members + user details + sessions
  Note over UI: If EF fails, fallback
  UI->>DB: select community_members by community_id
  UI->>DB: for each 100 IDs chunk, select users in(id_chunk)
  UI->>DB: select telegram_chat_sessions by community_id
  UI-->>UI: merge and render
</lov-mermaid>
