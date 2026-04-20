const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

export function parseLatLngFromMapsUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  let match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }
  match = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }
  match = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }
  return null;
}

export interface ReverseGeocodeResult {
  addressLine: string;
  street: string;
  area: string;
  city: string;
  pincode: string;
}

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'WeYouWeb/1.0 (address lookup)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      address?: {
        road?: string;
        house_number?: string;
        neighbourhood?: string;
        suburb?: string;
        village?: string;
        town?: string;
        city?: string;
        state_district?: string;
        state?: string;
        postcode?: string;
        country?: string;
      };
      display_name?: string;
    };
    const addr = data.address ?? {};
    const streetPart = [addr.house_number, addr.road].filter(Boolean).join(' ');
    const street = streetPart || addr.road || '';
    const area = addr.neighbourhood ?? addr.suburb ?? addr.village ?? addr.state_district ?? '';
    const city = addr.city ?? addr.town ?? addr.village ?? addr.state_district ?? addr.state ?? '';
    const pincode = addr.postcode ?? '';
    const addressLine = data.display_name ?? [street, area, city, addr.state, addr.country].filter(Boolean).join(', ');
    return { addressLine, street, area, city, pincode };
  } catch {
    return null;
  }
}

async function reverseGeocodeGoogle(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  if (!GOOGLE_API_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      results?: {
        formatted_address?: string;
        address_components?: { long_name: string; short_name: string; types: string[] }[];
      }[];
      status?: string;
    };
    if (data.status !== 'OK' || !data.results?.[0]) return null;
    const result = data.results[0];
    const components = result.address_components ?? [];
    const get = (...types: string[]) => components.find((c) => types.some((t) => c.types.includes(t)))?.long_name ?? '';
    const streetNumber = get('street_number');
    const route = get('route');
    const street = [streetNumber, route].filter(Boolean).join(' ');
    const sublocality = get('sublocality', 'sublocality_level_1', 'neighborhood');
    const locality = get('locality');
    const city = locality || get('administrative_area_level_2');
    const area = sublocality || locality || city;
    const pincode = get('postal_code');
    const addressLine = result.formatted_address ?? [street, area, city].filter(Boolean).join(', ');
    return { addressLine, street, area, city, pincode };
  } catch {
    return null;
  }
}

export async function reverseGeocodeAddress(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const fromNominatim = await reverseGeocodeNominatim(lat, lng);
  if (fromNominatim && (fromNominatim.addressLine || fromNominatim.city || fromNominatim.pincode)) return fromNominatim;
  return reverseGeocodeGoogle(lat, lng);
}

