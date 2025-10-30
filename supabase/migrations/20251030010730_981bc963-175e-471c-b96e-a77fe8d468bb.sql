-- Add timezone column to communities table
ALTER TABLE communities 
ADD COLUMN timezone TEXT DEFAULT 'UTC';

COMMENT ON COLUMN communities.timezone IS 'IANA timezone for community (e.g., America/New_York, Europe/London)';