#!/bin/sh
# Manual migration resolution script for production deployments
# Usage: sh scripts/resolve-migrations.sh

set -e

echo "🔧 Resolving failed Prisma migrations..."

SCHEMA_PATH="src/infra/prisma/schema.prisma"

# Check if schema exists
if [ ! -f "$SCHEMA_PATH" ]; then
    echo "❌ Prisma schema not found at $SCHEMA_PATH"
    exit 1
fi

echo "📋 Checking migration status..."

# List all migrations and their status
npx prisma migrate status --schema=$SCHEMA_PATH || true

echo ""
echo "🔄 Attempting to resolve failed migrations..."

# Common failed migrations to resolve
MIGRATIONS_TO_RESOLVE=(
    "20260211150000_backend_expansion"
    "20260213100000_add_segmented_pricing"
    "20260213120000_segment_category_table"
    "20260213180000_add_branches"
)

for MIGRATION in "${MIGRATIONS_TO_RESOLVE[@]}"; do
    echo ""
    echo "📦 Checking migration: $MIGRATION"
    
    # Try to mark as rolled back (ignore errors if not failed)
    echo "  → Marking as rolled back..."
    npx prisma migrate resolve --rolled-back "$MIGRATION" --schema=$SCHEMA_PATH 2>/dev/null && echo "  ✅ Done" || echo "  ⚠️  Skipped (not in failed state)"
    
    # Try to mark as applied
    echo "  → Marking as applied..."
    npx prisma migrate resolve --applied "$MIGRATION" --schema=$SCHEMA_PATH 2>/dev/null && echo "  ✅ Done" || echo "  ⚠️  Skipped (already applied or doesn't exist)"
done

echo ""
echo "🔄 Running migrations..."
if npx prisma migrate deploy --schema=$SCHEMA_PATH; then
    echo "✅ All migrations applied successfully!"
else
    echo "❌ Some migrations still failed."
    echo ""
    echo "💡 Manual resolution steps:"
    echo "1. Check which migration failed:"
    echo "   npx prisma migrate status --schema=$SCHEMA_PATH"
    echo ""
    echo "2. Resolve the failed migration (replace MIGRATION_NAME):"
    echo "   npx prisma migrate resolve --rolled-back \"MIGRATION_NAME\" --schema=$SCHEMA_PATH"
    echo "   npx prisma migrate resolve --applied \"MIGRATION_NAME\" --schema=$SCHEMA_PATH"
    echo ""
    echo "3. Retry migrations:"
    echo "   npx prisma migrate deploy --schema=$SCHEMA_PATH"
    exit 1
fi
