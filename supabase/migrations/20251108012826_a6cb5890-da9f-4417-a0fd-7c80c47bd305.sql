-- Create bot_templates table for marketplace
CREATE TABLE public.bot_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  long_description TEXT,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  use_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Bot configuration stored as JSON
  template_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Example prompts and use cases
  example_interactions TEXT[],
  
  -- Metadata
  difficulty_level TEXT DEFAULT 'beginner',
  estimated_setup_time INTEGER DEFAULT 5,
  
  CONSTRAINT valid_category CHECK (category IN ('community', 'productivity', 'entertainment', 'education', 'business', 'support', 'custom')),
  CONSTRAINT valid_difficulty CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced'))
);

-- Enable RLS
ALTER TABLE public.bot_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can view templates
CREATE POLICY "Anyone can view bot templates"
ON public.bot_templates
FOR SELECT
USING (true);

-- Authenticated users can create templates
CREATE POLICY "Authenticated users can create templates"
ON public.bot_templates
FOR INSERT
WITH CHECK (
  created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);

-- Template creators can update their templates
CREATE POLICY "Template creators can update templates"
ON public.bot_templates
FOR UPDATE
USING (
  created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);

-- Template creators can delete their templates
CREATE POLICY "Template creators can delete templates"
ON public.bot_templates
FOR DELETE
USING (
  created_by IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
);

-- Create indexes
CREATE INDEX idx_bot_templates_category ON public.bot_templates(category);
CREATE INDEX idx_bot_templates_featured ON public.bot_templates(is_featured) WHERE is_featured = true;
CREATE INDEX idx_bot_templates_use_count ON public.bot_templates(use_count DESC);

-- Insert sample templates
INSERT INTO public.bot_templates (name, description, long_description, category, tags, is_featured, template_config, example_interactions, difficulty_level, estimated_setup_time) VALUES
(
  'Community Assistant',
  'A friendly bot that helps manage community interactions and FAQs',
  'Perfect for community managers who want to automate common questions, welcome new members, and maintain engagement. This bot can handle FAQs, send automated welcome messages, and facilitate introductions.',
  'community',
  ARRAY['community', 'moderation', 'welcome', 'faq'],
  true,
  '{"agent_instructions": "You are a helpful community assistant. Welcome new members warmly, answer frequently asked questions, and help people connect with each other. Be friendly, inclusive, and proactive in fostering positive interactions.", "agent_temperature": 0.7, "agent_max_tokens": 1500, "suggested_messages": ["How can I get started?", "Tell me about this community", "How do I connect with others?"]}'::jsonb,
  ARRAY['Welcome! How can I help you get started in our community?', 'Let me introduce you to some active members who share your interests.', 'Here are the most common questions new members ask...'],
  'beginner',
  5
),
(
  'Daily Stand-up Bot',
  'Automate team check-ins and daily updates',
  'Keep your team aligned with automated daily stand-ups. This bot prompts team members for updates, compiles responses, and shares summaries. Great for remote teams and async workflows.',
  'productivity',
  ARRAY['productivity', 'team', 'standup', 'updates'],
  true,
  '{"agent_instructions": "You facilitate daily team stand-ups. Each morning, ask team members: What did you accomplish yesterday? What are you working on today? Any blockers? Compile responses into a clear summary for the team.", "agent_temperature": 0.5, "agent_max_tokens": 1000, "daily_message_enabled": true, "daily_message_time": "09:00:00", "daily_message_content": "Good morning team! Time for daily standup. Please share: 1) Yesterday''s wins 2) Today''s focus 3) Any blockers?"}'::jsonb,
  ARRAY['What did you work on yesterday?', 'Any blockers I should know about?', 'Here''s today''s team summary...'],
  'beginner',
  10
),
(
  'Event Coordinator',
  'Manage event planning, RSVPs, and reminders',
  'Perfect for communities running events. This bot handles event announcements, tracks RSVPs, sends reminders, and answers event-related questions. Can integrate with calendar systems.',
  'community',
  ARRAY['events', 'coordination', 'rsvp', 'reminders'],
  true,
  '{"agent_instructions": "You are an event coordination assistant. Help users discover upcoming events, manage RSVPs, send timely reminders, and answer questions about event details. Be organized and proactive about keeping attendees informed.", "agent_temperature": 0.6, "agent_max_tokens": 1200}'::jsonb,
  ARRAY['What events are coming up?', 'Count me in for the workshop!', 'Reminder: Tomorrow''s meetup starts at 6 PM'],
  'intermediate',
  15
),
(
  'Learning Companion',
  'Support educational communities with Q&A and resources',
  'Ideal for educational programs, bootcamps, or study groups. This bot can answer questions, share learning resources, track progress, and encourage peer learning.',
  'education',
  ARRAY['education', 'learning', 'study', 'resources'],
  false,
  '{"agent_instructions": "You are a supportive learning companion. Help students find resources, answer questions about course material, encourage collaboration, and celebrate learning milestones. Be patient, encouraging, and adapt to different learning styles.", "agent_temperature": 0.7, "agent_max_tokens": 2000}'::jsonb,
  ARRAY['Can you explain this concept?', 'Where can I find more resources on this topic?', 'Great progress this week! Keep it up.'],
  'intermediate',
  10
),
(
  'Customer Support Bot',
  'Provide instant customer support and ticket routing',
  'Handle customer inquiries 24/7. This bot can answer common questions, troubleshoot issues, collect feedback, and escalate complex cases to human support. Reduce response times and improve satisfaction.',
  'support',
  ARRAY['support', 'customer-service', 'help', 'tickets'],
  false,
  '{"agent_instructions": "You provide friendly, efficient customer support. Answer questions clearly, troubleshoot issues step-by-step, and collect necessary information for escalations. Always be patient and empathetic. If you cannot resolve an issue, acknowledge it and let the customer know a human will follow up.", "agent_temperature": 0.5, "agent_max_tokens": 1500}'::jsonb,
  ARRAY['How do I reset my password?', 'I''m having trouble with...', 'Let me escalate this to our team for you.'],
  'advanced',
  20
),
(
  'Content Curator',
  'Discover and share relevant content with your community',
  'Keep your community engaged with curated content. This bot can share articles, videos, and resources based on community interests, facilitate discussions, and crowdsource recommendations.',
  'entertainment',
  ARRAY['content', 'curation', 'media', 'discussion'],
  false,
  '{"agent_instructions": "You are a content curator who helps the community discover interesting and relevant content. Share articles, videos, and resources that match community interests. Facilitate discussions and encourage members to share their own finds.", "agent_temperature": 0.8, "agent_max_tokens": 1000}'::jsonb,
  ARRAY['Check out this interesting article about...', 'What content have you enjoyed this week?', 'Let''s discuss this topic...'],
  'beginner',
  8
);

-- Create updated_at trigger
CREATE TRIGGER update_bot_templates_updated_at
BEFORE UPDATE ON public.bot_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();