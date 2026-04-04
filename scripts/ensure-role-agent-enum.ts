/**
 * Adds 'AGENT' to Postgres enum "Role" if missing.
 * Run when create-admin-user fails with: invalid input value for enum "Role": "AGENT"
 *
 * Use direct Postgres (db.*.supabase.co:5432), not the transaction pooler (:6543).
 * Set DATABASE_DIRECT_URL in apps/api/.env, or temporarily put the direct URI in DATABASE_URL.
 *
 * Usage: npm run db:ensure-role-agent
 */
import { config } from 'dotenv';
import path from 'path';
import { PrismaClient } from '../apps/api/src/infra/generated/prisma-client';

config({ path: path.resolve(__dirname, '../apps/api/.env') });

function pickUrl(): string | undefined {
  const direct = process.env.DATABASE_DIRECT_URL?.trim();
  const pool = process.env.DATABASE_URL?.trim();
  return direct || pool;
}

async function main() {
  const url = pickUrl();
  if (!url) {
    console.error('Missing DATABASE_DIRECT_URL or DATABASE_URL in apps/api/.env');
    process.exit(1);
  }

  if (url.includes('pooler.supabase.com') && url.includes(':6543')) {
    console.warn(
      'Warning: URL looks like Supabase transaction pooler (:6543). DDL often fails here.\n' +
        'Set DATABASE_DIRECT_URL to the direct URI (db.<ref>.supabase.co:5432) and rerun.',
    );
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE 'AGENT'`);
    console.log('OK: added enum value AGENT to "Role".');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('already exists') || msg.includes('duplicate')) {
      console.log('OK: AGENT already exists on "Role" — no change needed.');
    } else {
      console.error(msg);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    '\nIf you fixed this outside `npm run prisma:migrate`, sync migration history with:\n' +
      '  npx prisma migrate resolve --applied 20260404120000_add_role_agent --schema=apps/api/src/infra/prisma/schema.prisma\n' +
      '(only if that migration is still pending in _prisma_migrations.)',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
