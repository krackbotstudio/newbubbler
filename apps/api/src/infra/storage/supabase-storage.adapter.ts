import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Readable } from 'stream';
import type { StorageAdapter } from '../../application/ports';
import * as path from 'path';

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  return map[ext] ?? 'application/octet-stream';
}

/**
 * Storage adapter that persists files in Supabase Storage.
 * Use env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and optionally SUPABASE_STORAGE_BUCKET (defaults to "assets").
 * Create the bucket with: npm run supabase:ensure-assets-bucket
 * Bucket should be public so logo/carousel/icons are reachable via returned URLs.
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(config: {
    url: string;
    serviceRoleKey: string;
    bucket: string;
  }) {
    this.client = createClient(config.url, config.serviceRoleKey);
    this.bucket = config.bucket;
  }

  async putObject(pathKey: string, buffer: Buffer, contentType: string): Promise<string> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(pathKey, buffer, { contentType, upsert: true });
    if (error) {
      throw new Error(`Supabase storage upload failed: ${error.message}`);
    }
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(pathKey);
    return data.publicUrl;
  }

  async getObjectStream(pathKey: string): Promise<Readable | null> {
    const { data, error } = await this.client.storage.from(this.bucket).download(pathKey);
    if (error || !data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    return Readable.from(buf);
  }

  getContentTypeForPath(pathKey: string): string {
    return getContentType(pathKey);
  }
}
