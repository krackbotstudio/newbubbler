export function extractHost(rawHost: string | undefined): string {
  return (rawHost ?? '').split(',')[0]?.trim().toLowerCase().split(':')[0] ?? '';
}

export function portalSlugFromHost(host: string): string | null {
  if (!host) return null;
  const parts = host.split('.');
  if (parts.length < 4) return null;
  // Expected: {slug}.bubbler.krackbot.com
  const tail = parts.slice(-3).join('.');
  if (tail !== 'bubbler.krackbot.com') return null;
  const slug = parts.slice(0, -3).join('.').trim();
  if (!slug) return null;
  return slug;
}

