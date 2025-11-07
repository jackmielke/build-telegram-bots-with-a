-- Delete the broken test cron and recreate with correct schema
SELECT cron.unschedule('test-buildathon-daily-message');
SELECT cron.unschedule('send-daily-telegram-messages');

-- Recreate the test cron (runs every minute)
SELECT cron.schedule(
  'test-buildathon-daily-message',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-daily-message',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHFxbnVib3dnd3Nud3ZsYWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjkxMzEsImV4cCI6MjA2NTYwNTEzMX0.VaAOevdkwQmOxd9ksOtOhnODVCITDhmtAgyE456IxbM"}'::jsonb,
    body:='{"test_mode": true, "community_id": "55cd9451-da1f-42b9-bb87-a7ca9d6c7320"}'::jsonb
  ) as request_id;
  $$
);

-- Recreate the main cron (runs every 15 minutes)
SELECT cron.schedule(
  'send-daily-telegram-messages',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-daily-message',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHFxbnVib3dnd3Nud3ZsYWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjkxMzEsImV4cCI6MjA2NTYwNTEzMX0.VaAOevdkwQmOxd9ksOtOhnODVCITDhmtAgyE456IxbM"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
