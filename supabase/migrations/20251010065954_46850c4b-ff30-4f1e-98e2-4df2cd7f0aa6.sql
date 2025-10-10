-- Add elevenlabs_agent_id to communities table
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS elevenlabs_agent_id text;