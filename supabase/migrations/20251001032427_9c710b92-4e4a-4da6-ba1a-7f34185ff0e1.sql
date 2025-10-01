-- Fix chat_type constraint to allow telegram_bot
-- First, drop the existing constraint
ALTER TABLE ai_chat_sessions DROP CONSTRAINT IF EXISTS ai_chat_sessions_chat_type_check;

-- Add updated constraint that includes telegram_bot
ALTER TABLE ai_chat_sessions ADD CONSTRAINT ai_chat_sessions_chat_type_check 
CHECK (chat_type IN ('ai', 'community', 'telegram_bot'));