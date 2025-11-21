-- Add World ID verification fields to users table
ALTER TABLE users 
ADD COLUMN world_id_verified boolean DEFAULT false,
ADD COLUMN world_id_nullifier_hash text UNIQUE,
ADD COLUMN world_id_verified_at timestamp with time zone;

-- Create index for faster lookups
CREATE INDEX idx_users_world_id_verified ON users(world_id_verified);
CREATE INDEX idx_users_world_id_nullifier ON users(world_id_nullifier_hash) WHERE world_id_nullifier_hash IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.world_id_verified IS 'Whether user has verified their identity with World ID';
COMMENT ON COLUMN users.world_id_nullifier_hash IS 'Unique World ID nullifier hash to prevent duplicate verifications';
COMMENT ON COLUMN users.world_id_verified_at IS 'Timestamp when World ID verification was completed';