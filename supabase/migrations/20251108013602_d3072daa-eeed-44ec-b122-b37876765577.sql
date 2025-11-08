-- Create product_roadmap table
CREATE TABLE public.product_roadmap (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  priority TEXT NOT NULL,
  category TEXT NOT NULL,
  estimated_timeline TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  order_index INTEGER DEFAULT 0,
  icon TEXT,
  tags TEXT[] DEFAULT '{}',
  
  CONSTRAINT valid_status CHECK (status IN ('planned', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  CONSTRAINT valid_category CHECK (category IN ('foundation', 'user_experience', 'integrations', 'monetization', 'developer_tools', 'platform', 'analytics', 'marketplace'))
);

-- Enable RLS
ALTER TABLE public.product_roadmap ENABLE ROW LEVEL SECURITY;

-- Anyone can view roadmap items
CREATE POLICY "Anyone can view product roadmap"
ON public.product_roadmap
FOR SELECT
USING (true);

-- Only admins can manage roadmap
CREATE POLICY "Admins can manage product roadmap"
ON public.product_roadmap
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN users u ON ur.user_id = u.id
    WHERE u.auth_user_id = auth.uid()
    AND ur.role = 'admin'
  )
);

-- Create index for ordering
CREATE INDEX idx_product_roadmap_order ON public.product_roadmap(order_index);
CREATE INDEX idx_product_roadmap_status ON public.product_roadmap(status);
CREATE INDEX idx_product_roadmap_priority ON public.product_roadmap(priority, order_index);

-- Create updated_at trigger
CREATE TRIGGER update_product_roadmap_updated_at
BEFORE UPDATE ON public.product_roadmap
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Pre-populate with roadmap items
INSERT INTO public.product_roadmap (title, description, status, priority, category, estimated_timeline, order_index, icon, tags) VALUES
-- Template Marketplace Features (Recently Completed)
('Template Marketplace', 'Discover and deploy pre-built bot templates with one-click setup. Includes featured templates, search, filtering, and deployment workflow.', 'completed', 'high', 'marketplace', 'Q1 2025', 1, '✨', ARRAY['templates', 'marketplace', 'deployment']),

-- Phase 1: Foundation & Retention (0-3 months) - High Priority
('Improved User Profiles', 'Enhanced profile system with automatic capture of new Telegram users, rich profile data, and personalized experiences.', 'in_progress', 'critical', 'foundation', 'Q1 2025', 2, '👤', ARRAY['profiles', 'users', 'personalization']),

('User Memories System', 'Persistent memory records for each user - messages, notes, events tied to individuals for personalized AI interactions and recommendations.', 'planned', 'critical', 'foundation', 'Q1 2025', 3, '🧠', ARRAY['memory', 'ai', 'personalization']),

('Photos & Videos for Memories', 'Support multimedia inputs (photos, videos, voice notes) as memory entries with automatic tagging, captioning, and searchable embeddings.', 'planned', 'high', 'user_experience', 'Q1 2025', 4, '📸', ARRAY['media', 'multimedia', 'memory']),

('Parallel Message Execution', 'Process multiple users and messages simultaneously to prevent blocking. Critical for scalability and reliability at scale.', 'planned', 'critical', 'platform', 'Q1 2025', 5, '⚡', ARRAY['performance', 'scalability', 'infrastructure']),

('Smart Daily Updates', 'Enhanced automated summaries with personalization, context awareness, and intelligent scheduling based on user preferences.', 'in_progress', 'high', 'user_experience', 'Q1-Q2 2025', 6, '📅', ARRAY['automation', 'summaries', 'notifications']),

-- Template Marketplace Extensions
('Template Management Interface', 'Admin interface to create, edit, delete, and feature templates directly from the dashboard.', 'planned', 'high', 'marketplace', 'Q1 2025', 7, '🛠️', ARRAY['templates', 'admin', 'management']),

('Template Preview Mode', 'Live preview and sample conversations before deploying templates to communities.', 'planned', 'medium', 'marketplace', 'Q2 2025', 8, '👁️', ARRAY['templates', 'preview', 'ux']),

('User-Created Templates', 'Allow community admins to save their bot configs as templates for others to discover and use.', 'planned', 'medium', 'marketplace', 'Q2 2025', 9, '🎨', ARRAY['templates', 'ugc', 'community']),

('Template Analytics Dashboard', 'Deployment stats, popular templates, usage trends, and engagement metrics across the marketplace.', 'planned', 'medium', 'analytics', 'Q2 2025', 10, '📊', ARRAY['analytics', 'templates', 'insights']),

-- Phase 2: Intelligence & Automation (3-6 months) - Medium Priority
('Voice Transcription', 'Integrate Whisper or AssemblyAI for instant voice-to-text, memory logging, and voice-based interactions.', 'planned', 'high', 'integrations', 'Q2 2025', 11, '🎙️', ARRAY['voice', 'transcription', 'ai']),

('Automated Discussion Summaries', 'AI-powered chat summaries every 24 hours with personalization and community context awareness.', 'planned', 'medium', 'user_experience', 'Q2 2025', 12, '📝', ARRAY['summaries', 'ai', 'automation']),

('Enhanced Custom Tools', 'Improved API integration builder with better testing, monitoring, and marketplace for sharing tools.', 'planned', 'high', 'developer_tools', 'Q2 2025', 13, '🔧', ARRAY['api', 'tools', 'integrations']),

('LangSmith Integration', 'Built-in tracing, monitoring, and debugging for AI conversations with detailed analytics and insights.', 'planned', 'medium', 'developer_tools', 'Q2 2025', 14, '🔍', ARRAY['debugging', 'monitoring', 'ai']),

('Analytics & Insights Dashboard', 'Comprehensive analytics for message volume, engagement metrics, AI costs, and community health.', 'planned', 'high', 'analytics', 'Q2 2025', 15, '📈', ARRAY['analytics', 'metrics', 'insights']),

-- Monetization & Business
('Monetization System', 'Freemium model with pro and enterprise tiers. Includes billing, usage tracking, and feature gates.', 'planned', 'critical', 'monetization', 'Q2 2025', 16, '💰', ARRAY['monetization', 'billing', 'saas']),

('Marketplace Revenue Model', 'Premium templates, revenue sharing for creators, and featured placement options.', 'planned', 'medium', 'monetization', 'Q2-Q3 2025', 17, '💎', ARRAY['marketplace', 'revenue', 'creators']),

-- Phase 3: Platform Expansion (6-12 months) - Strategic Bets
('WhatsApp Support', 'Expand beyond Telegram to WhatsApp for Latin America and global reach via Twilio or Meta Cloud API.', 'planned', 'high', 'integrations', 'Q3 2025', 18, '💬', ARRAY['whatsapp', 'messaging', 'expansion']),

('Token Launch Integration', 'Automate community token creation via Long.xyz API for community ownership and token economics.', 'planned', 'medium', 'integrations', 'Q3 2025', 19, '🪙', ARRAY['crypto', 'tokens', 'web3']),

('DevConnect QR Bot', 'Event-specific bot with QR code integration for physical-to-digital connections at conferences and meetups.', 'planned', 'medium', 'user_experience', 'Q3 2025', 20, '🎫', ARRAY['events', 'qr', 'networking']),

('Anonymous Interactions', 'Toggle for anonymous user interactions without revealing identity - for sensitive communities or experiments.', 'planned', 'low', 'user_experience', 'Q3 2025', 21, '🎭', ARRAY['privacy', 'anonymous', 'security']),

('Multi-Bot Management', 'Orchestrate multiple bots working together with conversation routing and handoff between agents.', 'planned', 'medium', 'platform', 'Q3 2025', 22, '🤖', ARRAY['bots', 'orchestration', 'automation']),

-- Developer Experience & Infrastructure
('Google OAuth', 'One-click sign-in with Google to reduce friction and improve trust for new users.', 'planned', 'medium', 'user_experience', 'Q2 2025', 23, '🔐', ARRAY['auth', 'oauth', 'login']),

('Mobile Admin App', 'Native mobile app for managing bots, viewing analytics, and responding to users on the go.', 'planned', 'medium', 'platform', 'Q3-Q4 2025', 24, '📱', ARRAY['mobile', 'admin', 'app']),

('A/B Testing Framework', 'Built-in experimentation platform for testing AI prompts, features, and workflows with analytics.', 'planned', 'low', 'developer_tools', 'Q4 2025', 25, '🧪', ARRAY['testing', 'experiments', 'optimization']),

('3D Avatar Generation', 'Use Meshy API to generate 3D avatars for bots and users - visual identity for communities.', 'planned', 'low', 'user_experience', 'Q4 2025', 26, '🎨', ARRAY['3d', 'avatars', 'visual']),

-- API & Ecosystem
('Cross-App Action System', 'Enable bots to trigger actions in external apps (Supabase, Airtable, Notion) for real automation.', 'planned', 'high', 'integrations', 'Q3 2025', 27, '🔗', ARRAY['api', 'automation', 'integrations']),

('External Data Sync', 'Event listeners and webhooks so external apps can push data to bots in real-time.', 'planned', 'medium', 'integrations', 'Q3 2025', 28, '🔄', ARRAY['webhooks', 'sync', 'api']),

('Public Developer API', 'Expose API layer for third-party developers to integrate bot builder into their systems.', 'planned', 'medium', 'developer_tools', 'Q4 2025', 29, '🌐', ARRAY['api', 'developers', 'ecosystem']),

-- Security & Compliance
('Enterprise Security', 'SOC2 compliance, GDPR compliance, audit logs, and enterprise-grade security features.', 'planned', 'high', 'platform', 'Q3-Q4 2025', 30, '🔒', ARRAY['security', 'compliance', 'enterprise']),

('Conversation Routing', 'Smart routing and handoff to human support when bot cannot resolve issues.', 'planned', 'medium', 'user_experience', 'Q3 2025', 31, '🔀', ARRAY['routing', 'support', 'handoff']);