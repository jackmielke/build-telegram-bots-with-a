-- Remove duplicate cron job (runs every minute, wasteful)
-- Keep only the hourly cron job (jobid 3)
SELECT cron.unschedule(4);