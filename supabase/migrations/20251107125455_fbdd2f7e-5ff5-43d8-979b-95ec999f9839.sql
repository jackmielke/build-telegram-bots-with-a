
-- First unschedule the existing job
SELECT cron.unschedule('send-daily-telegram-messages');

-- Create the cron job with the correct 15-minute schedule
SELECT cron.schedule(
  'send-daily-telegram-messages',
  '*/15 * * * *',  -- Run every 15 minutes
  $$
  SELECT net.http_post(
    url:='https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-daily-message',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHFxbnVib3dnd3Nud3ZsYWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjkxMzEsImV4cCI6MjA2NTYwNTEzMX0.VaAOevdkwQmOxd9ksOtOhnODVCITDhmtAgyE456IxbM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
