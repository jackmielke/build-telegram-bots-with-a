-- Create a test cron job that runs every minute for Buildathon bot
SELECT cron.schedule(
  'test-buildathon-daily-message',
  '* * * * *',  -- Every minute
  $$
  SELECT extensions.http_post(
    url:='https://efdqqnubowgwsnwvlalp.supabase.co/functions/v1/telegram-daily-message',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZHFxbnVib3dnd3Nud3ZsYWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwMjkxMzEsImV4cCI6MjA2NTYwNTEzMX0.VaAOevdkwQmOxd9ksOtOhnODVCITDhmtAgyE456IxbM"}'::jsonb,
    body:='{"test_mode": true, "community_id": "55cd9451-da1f-42b9-bb87-a7ca9d6c7320"}'::jsonb
  ) as request_id;
  $$
);
