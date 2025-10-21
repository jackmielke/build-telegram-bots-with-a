-- Add attachments column to messages table for storing image and file metadata
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;

COMMENT ON COLUMN public.messages.attachments IS 'Stores metadata for images, documents, and other file attachments. Format: {"images": [{"telegram_file_id": "xxx", "file_url": "https://...", "file_size": 123}]}';

-- Add index for querying messages with attachments
CREATE INDEX IF NOT EXISTS idx_messages_attachments ON public.messages USING gin(attachments) WHERE attachments IS NOT NULL;