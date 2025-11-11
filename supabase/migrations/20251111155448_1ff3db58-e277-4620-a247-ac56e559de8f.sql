-- Performance indexes to prevent statement timeouts on common RLS joins and queries (retry without views)

-- Speed up RLS membership checks that JOIN community_members -> users by auth_user_id
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- Speed up community membership lookups
CREATE INDEX IF NOT EXISTS idx_cm_community_user ON public.community_members(community_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cm_user ON public.community_members(user_id);

-- Speed up memories listing by community and recency
CREATE INDEX IF NOT EXISTS idx_memories_community_created_at ON public.memories(community_id, created_at DESC);

-- Speed up workflows queries filtered by community and type
CREATE INDEX IF NOT EXISTS idx_workflows_community ON public.community_workflows(community_id);
CREATE INDEX IF NOT EXISTS idx_workflows_community_type ON public.community_workflows(community_id, workflow_type);

-- messages is a table; optimize conversation lookups
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
