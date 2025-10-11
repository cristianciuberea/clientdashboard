/*
  # Update sync frequency to 5 minutes

  1. Changes
    - Update default sync_frequency from 60 to 5 minutes for integrations table
    - Update all existing integrations to sync every 5 minutes instead of 60
  
  2. Purpose
    - Enable more frequent data synchronization (every 5 minutes)
    - Provide more up-to-date metrics in dashboards
*/

-- Update default value for new integrations
ALTER TABLE integrations 
ALTER COLUMN sync_frequency SET DEFAULT 5;

-- Update all existing integrations to use 5 minute sync frequency
UPDATE integrations 
SET sync_frequency = 5 
WHERE sync_frequency = 60 OR sync_frequency IS NULL;