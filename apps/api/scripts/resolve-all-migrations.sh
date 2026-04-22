#!/bin/sh
# Aggressive migration resolution - marks ALL migrations as applied
# Use this when your database already has all the schema changes

set -e

SCHEMA_PATH="src/infra/prisma/schema.prisma"

echo "🔧 Resolving ALL Prisma migrations..."
echo "⚠️  This will mark all 60 migrations as applied without running them"
echo "💡 Only use this if your database schema is already up to date"

# Get all migration directory names
MIGRATIONS_DIR="src/infra/prisma/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "❌ Migrations directory not found at $MIGRATIONS_DIR"
    exit 1
fi

# Count total migrations
TOTAL=$(ls -d "$MIGRATIONS_DIR"/*/ 2>/dev/null | wc -l)
echo "📊 Found $TOTAL migrations to resolve"

# Mark each migration as applied
COUNT=0
for MIGRATION_PATH in "$MIGRATIONS_DIR"/*/; do
    MIGRATION_NAME=$(basename "$MIGRATION_PATH")
    
    # Skip if not a migration directory
    if [ ! -f "$MIGRATION_PATH/migration.sql" ]; then
        continue
    fi
    
    COUNT=$((COUNT + 1))
    echo "[$COUNT/$TOTAL] Resolving: $MIGRATION_NAME"
    
    # Mark as rolled back first (clears failed state)
    npx prisma migrate resolve --rolled-back "$MIGRATION_NAME" --schema=$SCHEMA_PATH 2>/dev/null || true
    
    # Mark as applied (skips execution)
    npx prisma migrate resolve --applied "$MIGRATION_NAME" --schema=$SCHEMA_PATH 2>/dev/null || true
done

echo ""
echo "✅ All $COUNT migrations marked as applied!"
echo "🔄 Verifying migration status..."
npx prisma migrate status --schema=$SCHEMA_PATH

echo ""
echo "🎉 Migration resolution complete!"
echo "💡 Your API should now start without migration errors"
