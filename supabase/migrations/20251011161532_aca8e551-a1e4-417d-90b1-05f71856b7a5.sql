-- Add proactive outreach fields to telegram_chat_sessions
ALTER TABLE telegram_chat_sessions 
ADD COLUMN IF NOT EXISTS proactive_outreach_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_outreach_at timestamp with time zone;

-- Create outreach_logs table to track all proactive messages
CREATE TABLE IF NOT EXISTS outreach_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id uuid REFERENCES telegram_chat_sessions(id) ON DELETE CASCADE NOT NULL,
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
  telegram_chat_id bigint NOT NULL,
  message_sent text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('manual', 'scheduled')),
  ai_prompt text,
  success boolean DEFAULT true,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on outreach_logs
ALTER TABLE outreach_logs ENABLE ROW LEVEL SECURITY;

-- Community admins can view outreach logs
CREATE POLICY "Community admins can view outreach logs"
ON outreach_logs
FOR SELECT
USING (is_community_admin(community_id, auth.uid()));

-- Edge functions can insert outreach logs
CREATE POLICY "Edge functions can insert outreach logs"
ON outreach_logs
FOR INSERT
WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_outreach_logs_chat_session ON outreach_logs(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_outreach_logs_created_at ON outreach_logs(created_at DESC);

-- Comment on columns
COMMENT ON COLUMN telegram_chat_sessions.proactive_outreach_enabled IS 'Whether proactive daily outreach is enabled for this conversation';
COMMENT ON COLUMN telegram_chat_sessions.last_outreach_at IS 'Timestamp of the last proactive outreach message sent';
COMMENT ON TABLE outreach_logs IS 'Logs all proactive outreach messages sent by the bot';