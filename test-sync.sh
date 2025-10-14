#!/bin/bash

# Test sync-scheduler manually
# Replace with your actual values

SUPABASE_URL="YOUR_SUPABASE_URL"  # ex: https://xxxxx.supabase.co
SERVICE_KEY="YOUR_SERVICE_ROLE_KEY"

echo "🔄 Testing sync-scheduler..."
echo ""

curl -X POST "$SUPABASE_URL/functions/v1/sync-scheduler" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -v

echo ""
echo "✅ Check the response above to see if sync worked!"

