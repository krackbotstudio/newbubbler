#!/bin/sh
# Run Prisma migrations for production deployment
# This script should be run before starting the API server

echo "Starting database migrations..."

# Set the schema path
SCHEMA_PATH="src/infra/prisma/schema.prisma"

# Check if schema file exists
if [ ! -f "$SCHEMA_PATH" ]; then
    echo "Error: Prisma schema not found at $SCHEMA_PATH"
    exit 1
fi

# Run migrations
npx prisma migrate deploy --schema=$SCHEMA_PATH

# Check if migration was successful
if [ $? -eq 0 ]; then
    echo "✅ Database migrations completed successfully"
    exit 0
else
    echo "❌ Database migrations failed"
    exit 1
fi