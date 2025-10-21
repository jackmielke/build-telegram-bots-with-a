-- Fix invalid model names in communities table
-- Update gpt-5-mini-2025-08-07 to google/gemini-2.5-flash (recommended default)
UPDATE communities 
SET agent_model = 'google/gemini-2.5-flash' 
WHERE agent_model = 'gpt-5-mini-2025-08-07';

-- Update gpt-4o to google/gemini-2.5-flash (gpt-4o is old OpenRouter model, not valid for Lovable AI)
UPDATE communities 
SET agent_model = 'google/gemini-2.5-flash' 
WHERE agent_model = 'gpt-4o';