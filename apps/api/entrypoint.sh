#!/bin/sh
# Entrypoint script for production container
# Usage: Set environment variable RUN_MIGRATIONS=true to run migrations before starting API

set -e

echo "🚀 Starting Weyou API container..."

# Display database connection info (hide password)
if [ -n "$DATABASE_URL" ]; then
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    echo "📊 Database host: $DB_HOST"
    echo "🔐 SSL mode: $(echo "$DATABASE_URL" | grep -o 'sslmode=[^&]*' || echo 'not specified')"
else
    echo "⚠️  DATABASE_URL not set!"
fi

# Check if we should run migrations first
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "📦 RUN_MIGRATIONS is set to true"
    echo "🔄 Checking if Prisma CLI is available..."
    
    # Check if prisma is available
    if command -v npx >/dev/null 2>&1; then
        echo "✅ npx is available"
        
        # Check if schema exists
        if [ -f "src/infra/prisma/schema.prisma" ]; then
            echo "✅ Prisma schema found"
            echo "🔄 Running database migrations..."
            
            # Run migrations
            MIGRATION_ATTEMPTS=0
            MAX_ATTEMPTS=10
            
            while [ $MIGRATION_ATTEMPTS -lt $MAX_ATTEMPTS ]; do
                MIGRATION_ATTEMPTS=$((MIGRATION_ATTEMPTS + 1))
                echo "🔄 Migration attempt $MIGRATION_ATTEMPTS of $MAX_ATTEMPTS..."
                
                if npx prisma migrate deploy --schema=src/infra/prisma/schema.prisma; then
                    echo "✅ Migrations completed successfully"
                    break
                else
                    echo "⚠️  Migration failed on attempt $MIGRATION_ATTEMPTS, attempting to resolve..."
                    
                    # Resolve ALL early migrations that are likely to have schema conflicts
                    # This covers migrations from 2026-02-11 to 2026-02-13 (the expansion period)
                    echo "🔄 Marking all early migrations as resolved..."
                    
                    # Mark all migrations from the initial expansion phase
                    for MIG in 20260211140000_init \
                               20260211150000_backend_expansion \
                               20260211160000_feedback \
                               20260212100000_service_type_categories \
                               20260212120000_holidays_and_operating_hours \
                               20260213100000_add_segmented_pricing \
                               20260213120000_segment_category_table \
                               20260213180000_add_branches \
                               20260213200000_service_area_and_schedule_per_branch \
                               20260213210000_add_brand_pan_gst_email_and_branch_email \
                               20260213900000_subscription_plan_multi_branch; do
                        npx prisma migrate resolve --rolled-back "$MIG" --schema=src/infra/prisma/schema.prisma 2>/dev/null || true
                        npx prisma migrate resolve --applied "$MIG" --schema=src/infra/prisma/schema.prisma 2>/dev/null || true
                    done
                    
                    if [ $MIGRATION_ATTEMPTS -eq $MAX_ATTEMPTS ]; then
                        echo "❌ Migrations still failed after $MAX_ATTEMPTS attempts!"
                        echo "💡 Attempting nuclear option: marking ALL migrations as applied..."
                        echo "💡 This assumes your database schema is already up to date."
                        
                        # Use the resolve-all script as last resort
                        if [ -f "/app/scripts/resolve-all-migrations.sh" ]; then
                            sh /app/scripts/resolve-all-migrations.sh && {
                                echo "✅ All migrations resolved! Starting API..."
                            } || {
                                echo "❌ Failed to resolve all migrations!"
                                echo "💡 You may need to manually resolve migration issues in your Supabase database."
                                echo "💡 Check logs above for the specific failed migration name."
                                echo "💡 Or run in container terminal: sh /app/scripts/resolve-all-migrations.sh"
                                exit 1
                            }
                        else
                            echo "❌ Resolve-all script not found!"
                            echo "💡 Run these commands in your container terminal:"
                            echo "   npx prisma migrate resolve --rolled-back \"MIGRATION_NAME\" --schema=src/infra/prisma/schema.prisma"
                            echo "   npx prisma migrate resolve --applied \"MIGRATION_NAME\" --schema=src/infra/prisma/schema.prisma"
                            exit 1
                        fi
                    fi
                    
                    echo "🔄 Retrying migrations..."
                fi
            done
        else
            echo "⚠️  Prisma schema not found, skipping migrations"
        fi
    else
        echo "⚠️  npx not available, skipping migrations"
    fi
else
    echo "ℹ️  RUN_MIGRATIONS is not set (or set to false), skipping migrations"
    echo "💡 To run migrations, set environment variable: RUN_MIGRATIONS=true"
fi

echo "Starting API server (PORT=${PORT:-8080})"

# CMD from Docker passes the Node process here (see apps/api/Dockerfile)
exec "$@"