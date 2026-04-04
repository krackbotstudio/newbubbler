/**
 * Ensures the Supabase Storage bucket used by the API exists (default name: assets, public).
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/api/.env (or repo root .env).
 *
 * Run: npm run supabase:ensure-assets-bucket
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env'), override: true });

const DEFAULT_BUCKET = 'assets';

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? DEFAULT_BUCKET;

  if (!url || !key) {
    console.error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in apps/api/.env.',
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error('Failed to list buckets:', listError.message);
    process.exit(1);
  }

  if (buckets?.some((b) => b.name === bucket)) {
    console.log(`Storage bucket "${bucket}" already exists.`);
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
  });
  if (createError) {
    console.error('Failed to create bucket:', createError.message);
    process.exit(1);
  }

  console.log(`Created public storage bucket "${bucket}".`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
