-- Update cron job to use extensions.http_post instead of net.http_post
SELECT cron.unschedule('send-daily-telegram-messages');

SELECT cron.schedule(
  'send-daily-telegram-messages',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  SELECT extensions.http_post(
    url:='https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-daily-message',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHFxbnVib3dnd3Nud3ZsYWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjkxMzEsImV4cCI6MjA2NTYwNTEzMX0.VaAOevdkwQmOxd9ksOtOhnODVCITDhmtAgyE456IxbM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
