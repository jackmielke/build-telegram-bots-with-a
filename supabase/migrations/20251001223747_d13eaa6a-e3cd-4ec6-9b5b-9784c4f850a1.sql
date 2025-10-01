-- Set default intro message for communities that don't have one
UPDATE communities 
SET agent_intro_message = 
  'hey there — welcome! how''s it going? what can i help you with today at ' || lower(name) || '?

some quick things i can do:
- answer questions about the community
- help you connect with others
- provide info and resources
- assist with projects and ideas

tell me what you need and i''ll get on it.'
WHERE agent_intro_message IS NULL OR agent_intro_message = '';