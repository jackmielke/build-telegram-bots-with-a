-- Add wallet connection fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS wallet_address text,
ADD COLUMN IF NOT EXISTS wallet_provider text,
ADD COLUMN IF NOT EXISTS wallet_connected_at timestamp with time zone;

-- Create index for wallet lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);

-- Add comment for clarity
COMMENT ON COLUMN users.wallet_address IS 'User''s connected crypto wallet address';
COMMENT ON COLUMN users.wallet_provider IS 'Wallet provider (metamask, coinbase, etc)';
COMMENT ON COLUMN users.wallet_connected_at IS 'Timestamp when wallet was connected';