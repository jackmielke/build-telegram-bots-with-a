-- Update default intro message for all communities to use proper capitalization
UPDATE communities 
SET agent_intro_message = 
  'Hey there, welcome! How''s it going? What can I help you with today at ' || lower(name) || '?

Some quick things I can do:
- answer questions about the community
- help you connect with others
- provide info and resources
- assist with projects and ideas

Tell me what you need and I''ll get on it.'
WHERE agent_intro_message LIKE 'hey there%' OR agent_intro_message = '';