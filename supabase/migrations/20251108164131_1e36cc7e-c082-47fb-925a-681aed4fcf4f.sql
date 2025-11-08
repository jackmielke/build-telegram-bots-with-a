-- Add voting columns to product_roadmap table
ALTER TABLE product_roadmap 
ADD COLUMN upvotes integer DEFAULT 0,
ADD COLUMN downvotes integer DEFAULT 0;

-- Create index for better performance
CREATE INDEX idx_product_roadmap_votes ON product_roadmap(upvotes DESC, downvotes DESC);