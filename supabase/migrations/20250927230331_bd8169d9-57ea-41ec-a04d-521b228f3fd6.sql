-- Create community_workflows table to manage workflow toggles per community
CREATE TABLE public.community_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  workflow_type TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false, -- Default to disabled for safety
  configuration JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(community_id, workflow_type)
);

-- Enable RLS
ALTER TABLE public.community_workflows ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Community admins can manage workflows" 
ON public.community_workflows 
FOR ALL 
USING (is_community_admin(community_id, auth.uid()));

CREATE POLICY "Community members can view workflow status" 
ON public.community_workflows 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM community_members cm 
  JOIN users u ON cm.user_id = u.id 
  WHERE cm.community_id = community_workflows.community_id 
  AND u.auth_user_id = auth.uid()
));

-- Add trigger for updated_at
CREATE TRIGGER update_community_workflows_updated_at
BEFORE UPDATE ON public.community_workflows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default workflow records for existing communities (all disabled by default)
INSERT INTO public.community_workflows (community_id, workflow_type, is_enabled)
SELECT 
  c.id as community_id,
  workflow.type as workflow_type,
  false as is_enabled
FROM public.communities c
CROSS JOIN (
  VALUES 
    ('telegram_integration'),
    ('email_notifications'), 
    ('slack_integration'),
    ('discord_integration'),
    ('webhook_integration')
) AS workflow(type)
ON CONFLICT (community_id, workflow_type) DO NOTHING;