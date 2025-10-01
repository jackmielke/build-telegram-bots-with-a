-- Update all communities to use proper capitalization and placeholder tokens
UPDATE communities 
SET agent_intro_message = 
  'Hey {first_name}, welcome! How''s it going? What can I help you with today at {community_name}?

Some quick things I can do:
- answer questions about the community
- help you connect with others
- provide info and resources
- assist with projects and ideas

Tell me what you need and I''ll get on it.'
WHERE agent_intro_message IS NULL 
   OR agent_intro_message = '' 
   OR agent_intro_message LIKE 'hey there%' 
   OR agent_intro_message LIKE 'Hey there%';