-- Update sync frequency from 5 minutes to 60 minutes to avoid API rate limits
-- This prevents Facebook API from blocking the application due to too many requests

-- Update the default value for sync_frequency column
ALTER TABLE integrations 
ALTER COLUMN sync_frequency SET DEFAULT 60;

-- Update existing integrations to use 60 minutes instead of 5 minutes
UPDATE integrations 
SET sync_frequency = 60
WHERE sync_frequency = 5;
