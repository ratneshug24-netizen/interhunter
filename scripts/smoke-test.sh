#!/bin/bash
set -e

echo "🚀 Starting smoke test..."

# Ensure we're in the project root
cd "$(dirname "$0")/.."

export DATABASE_URL="postgresql://internhunter:internhunter_secret@localhost:5432/internhunter?schema=public"
export REDIS_HOST="localhost"
export REDIS_PORT="6379"

# 1. Start Docker compose
echo "🐳 Starting services..."
docker compose up -d

# Function to teardown on exit
cleanup() {
  echo "🧹 Tearing down docker compose..."
  docker compose down -v
}
trap cleanup EXIT

# 2. Wait for API Health Check
echo "⏳ Waiting for API to be healthy..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
  if curl -s http://localhost:4000/api/health | grep -q "ok"; then
    echo "✅ API is up and healthy!"
    break
  fi
  echo "   Still waiting... ($RETRIES left)"
  sleep 2
  RETRIES=$((RETRIES-1))
done

if [ $RETRIES -eq 0 ]; then
  echo "❌ API failed to become healthy in time."
  exit 1
fi

# 3. Setup Database
echo "🗄️ Setting up database..."
npm run db:push --workspace=@internhunter/api
npm run db:seed --workspace=@internhunter/api

# 4. Run Pipeline
echo "⚙️ Running aggregation pipeline..."
npx tsx apps/api/src/scripts/runPipeline.ts

# 5. Assert Prospects
echo "🔍 Fetching prospects from API..."
RESPONSE=$(curl -s "http://localhost:4000/api/prospects")

PROSPECT_COUNT=$(echo $RESPONSE | grep -o '"data":\[' | wc -l || true)
if [[ "$RESPONSE" == *"\"data\":["* ]] && [[ ${#RESPONSE} -gt 100 ]]; then
  echo "✅ Prospects found in the API response!"
else
  echo "❌ No prospects returned by the API or invalid response."
  echo "Response was: $RESPONSE"
  exit 1
fi

echo "🎉 Smoke test passed successfully!"
