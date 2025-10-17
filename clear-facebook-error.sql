-- Clear Facebook API error message for Romeo Popescu
-- This will allow the integration to retry and show current status

UPDATE integrations 
SET 
  error_message = NULL,
  status = 'active',
  updated_at = now()
WHERE 
  platform = 'facebook_ads' 
  AND client_id = (
    SELECT id FROM clients WHERE name ILIKE '%romeo%' LIMIT 1
  );

-- Verify the update
SELECT 
  i.id,
  i.platform,
  i.status,
  i.error_message,
  i.last_sync_at,
  i.updated_at,
  c.name as client_name
FROM integrations i
JOIN clients c ON i.client_id = c.id
WHERE i.platform = 'facebook_ads' 
  AND c.name ILIKE '%romeo%';
