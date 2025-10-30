-- Create cron job to run telegram-daily-message every minute
-- This will check all communities and send messages at their scheduled times
SELECT cron.schedule(
  'telegram-daily-message-cron',
  '* * * * *', -- Run every minute
  $$
  SELECT
    net.http_post(
      url:='https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-daily-message',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHFxbnVib3dnd3Nud3ZsYWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjkxMzEsImV4cCI6MjA2NTYwNTEzMX0.VaAOevdkwQmOxd9ksOtOhnODVCITDhmtAgyE456IxbM"}'::jsonb,
      body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);