-- Enable pg_net extension (required for cron http calls)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Grant usage on net schema functions to postgres role
GRANT USAGE ON SCHEMA extensions TO postgres;
