-- Create custom_tools table for storing external API integrations
CREATE TABLE public.custom_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  
  -- Tool Identity
  name TEXT NOT NULL, -- e.g., "submit_vibe", "weather_lookup"
  display_name TEXT NOT NULL, -- e.g., "Vibe Check", "Weather Lookup"
  description TEXT NOT NULL, -- For AI to understand when to use it
  
  -- API Configuration
  endpoint_url TEXT NOT NULL, -- Full URL to the external API
  http_method TEXT NOT NULL DEFAULT 'POST', -- GET, POST, PUT, DELETE
  auth_type TEXT NOT NULL DEFAULT 'none', -- 'none', 'api_key', 'bearer'
  auth_value TEXT, -- API key or token
  
  -- Parameters Definition (JSON Schema)
  parameters JSONB DEFAULT '{}'::jsonb, -- Defines what the AI should collect
  
  -- Request/Response Configuration
  request_template JSONB, -- How to transform AI args into API request
  response_mapping JSONB, -- How to extract data from API response
  
  -- Metadata
  is_enabled BOOLEAN DEFAULT true,
  icon TEXT, -- Optional icon identifier
  category TEXT, -- Group tools by category
  
  -- Debugging
  last_test_at TIMESTAMP WITH TIME ZONE,
  last_test_result JSONB,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  
  -- Rate limiting
  rate_limit_per_hour INTEGER DEFAULT 100,
  timeout_seconds INTEGER DEFAULT 10,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint per community
  CONSTRAINT unique_community_tool_name UNIQUE(community_id, name)
);

-- Create index for quick lookups
CREATE INDEX idx_custom_tools_community_enabled ON public.custom_tools(community_id, is_enabled);
CREATE INDEX idx_custom_tools_category ON public.custom_tools(category);

-- Create custom_tool_logs table for debugging and monitoring
CREATE TABLE public.custom_tool_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES public.custom_tools(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  input_data JSONB,
  output_data JSONB,
  status_code INTEGER,
  error_message TEXT,
  execution_time_ms INTEGER,
  
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  message_context TEXT -- Original user message that triggered tool
);

-- Index for cleanup and queries
CREATE INDEX idx_tool_logs_executed_at ON public.custom_tool_logs(executed_at);
CREATE INDEX idx_tool_logs_tool_id ON public.custom_tool_logs(tool_id, executed_at DESC);
CREATE INDEX idx_tool_logs_community ON public.custom_tool_logs(community_id, executed_at DESC);

-- Enable RLS
ALTER TABLE public.custom_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_tool_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_tools
CREATE POLICY "Community admins can manage custom tools"
ON public.custom_tools
FOR ALL
USING (is_community_admin(community_id, auth.uid()));

CREATE POLICY "Community members can view enabled custom tools"
ON public.custom_tools
FOR SELECT
USING (
  is_enabled = true 
  AND EXISTS (
    SELECT 1 FROM community_members cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.community_id = custom_tools.community_id
    AND u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Edge functions can access custom tools"
ON public.custom_tools
FOR SELECT
USING (true);

CREATE POLICY "Edge functions can update custom tools for metrics"
ON public.custom_tools
FOR UPDATE
USING (true);

-- RLS Policies for custom_tool_logs
CREATE POLICY "Community admins can view tool logs"
ON public.custom_tool_logs
FOR SELECT
USING (is_community_admin(community_id, auth.uid()));

CREATE POLICY "Edge functions can insert logs"
ON public.custom_tool_logs
FOR INSERT
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_custom_tools_updated_at
BEFORE UPDATE ON public.custom_tools
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.custom_tools IS 'Stores custom API tool integrations for Telegram bot communities';
COMMENT ON TABLE public.custom_tool_logs IS 'Logs execution history of custom tools for debugging and monitoring';