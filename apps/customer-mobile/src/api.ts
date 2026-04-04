import { API_BASE_URL, getApiBase, API_TIMEOUT_MS } from './config/api';

const apiBase = getApiBase;
const apiRoot = (): string => (API_BASE_URL ? API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/$/, '') : '');

/** Fetch with timeout (uses API_TIMEOUT_MS). Clears timeout on success or throw. */
async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = API_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/** Call before login to verify the app can reach the API. Throws with a clear message if not. */
export async function testConnection(): Promise<void> {
  const base = apiBase();
  if (!base) throw new Error('EXPO_PUBLIC_API_URL is not set in .env. Restart Expo after adding it.');
  const rootUrl = base.replace(/\/api\/?$/, '');
  try {
    let res = await fetchWithTimeout(`${rootUrl}/api`, { method: 'GET' });
    if (res.status === 404) {
      res = await fetchWithTimeout(`${rootUrl}/`, { method: 'GET' });
    }
    if (!res.ok) {
      const msg = res.status >= 502 && res.status <= 504
        ? 'Server is starting or busy. Please try again.'
        : res.status === 404
          ? 'API returned 404. Redeploy the API from the latest code.'
          : `Server returned ${res.status}. Check that the API is deployed and running.`;
      throw new Error(msg);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Connection timed out. Check network and try again.');
    }
    throw err;
  }
}

/** Public branding for welcome screen and login T&C/Privacy. No auth. */
export interface PublicBrandingResponse {
  businessName: string | null;
  logoUrl: string | null;
  /** Admin Branding "App icon" — preferred for PWA/tab favicon when set. */
  appIconUrl: string | null;
  termsAndConditions: string | null;
  privacyPolicy: string | null;
  /** Welcome screen background image (shown at 50% opacity). */
  welcomeBackgroundUrl: string | null;
  /** Optional: branch or billing address (shown on invoices). */
  address?: string | null;
  /** Optional: GSTIN printed on invoices. */
  gstNumber?: string | null;
  /** Optional: PAN number printed on invoices. */
  panNumber?: string | null;
}

export async function getPublicBranding(): Promise<PublicBrandingResponse> {
  const empty: PublicBrandingResponse = {
    businessName: null,
    logoUrl: null,
    appIconUrl: null,
    termsAndConditions: null,
    privacyPolicy: null,
    welcomeBackgroundUrl: null,
  };
  const base = apiBase();
  if (!base) return empty;
  try {
    const res = await fetchWithTimeout(`${base}/branding/public`);
    if (!res.ok) return empty;
    const data = (await res.json()) as PublicBrandingResponse;
    return {
      businessName: data.businessName ?? null,
      logoUrl: data.logoUrl ?? null,
      appIconUrl: data.appIconUrl ?? null,
      termsAndConditions: data.termsAndConditions ?? null,
      privacyPolicy: data.privacyPolicy ?? null,
      welcomeBackgroundUrl: data.welcomeBackgroundUrl ?? null,
    };
  } catch {
    return empty;
  }
}

/** Build full URL for branding logo or welcome background. API returns relative path (e.g. /api/assets/branding/xxx); prepend API base so the mobile app can load the image. */
export function brandingLogoFullUrl(logoUrl: string | null): string | null {
  if (!logoUrl?.trim()) return null;
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) return logoUrl;
  const base = apiRoot();
  if (!base) return null;
  const path = logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`;
  return `${base}${path}`;
}

/** Full URL for welcome background (same as logo URL builder). */
export function brandingWelcomeBackgroundFullUrl(url: string | null): string | null {
  return brandingLogoFullUrl(url);
}

/** Public carousel for home screen. No auth. */
export interface PublicCarouselResponse {
  imageUrls: string[];
}

export async function getPublicCarousel(): Promise<PublicCarouselResponse> {
  const base = apiBase();
  if (!base) return { imageUrls: [] };
  try {
    const res = await fetchWithTimeout(`${base}/carousel/public`);
    if (!res.ok) return { imageUrls: [] };
    const data = (await res.json()) as PublicCarouselResponse;
    return { imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [] };
  } catch {
    return { imageUrls: [] };
  }
}

/** Build full URL for carousel image (imageUrl from API is e.g. /api/assets/carousel/xxx). */
export function carouselImageFullUrl(imageUrl: string): string {
  if (!imageUrl?.trim()) return '';
  if (imageUrl.startsWith('http')) return imageUrl;
  const base = apiRoot();
  if (!base) return imageUrl;
  const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  return `${base}${path}`;
}

// --- Auth (Twilio via backend) ---
export interface VerifyOtpResponse {
  token: string;
  user: { id: string; phone: string; role: string };
}


async function parseErrorResponse(res: Response): Promise<string> {
  if (res.status >= 502 && res.status <= 504) {
    return 'Server is starting or busy. If using Render, wait a moment and try again.';
  }
  if (res.status === 404) {
    return 'Request failed (404). The API may need to be redeployed.';
  }
  try {
    const data = (await res.json()) as { message?: string };
    return data.message ?? res.statusText ?? `Request failed (${res.status})`;
  } catch {
    return res.statusText || `Request failed (${res.status})`;
  }
}

export async function requestOtp(phone: string): Promise<{ requestId: string }> {
  const base = apiBase();
  if (!base) {
    throw new Error(
      'API URL not set. Add EXPO_PUBLIC_API_URL in .env and restart Expo.'
    );
  }
  try {
    const res = await fetchWithTimeout(`${base}/auth/customer/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim() }),
    });
    if (!res.ok) {
      const msg = await parseErrorResponse(res);
      throw new Error(msg);
    }
    return res.json() as Promise<{ requestId: string }>;
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Check network and EXPO_PUBLIC_API_URL, then try again.');
      }
      if (err.message === 'Network request failed' || err.message.includes('Network')) {
        throw new Error('Cannot reach server. Set EXPO_PUBLIC_API_URL in .env and restart Expo.');
      }
    }
    throw err;
  }
}

export async function verifyOtp(
  phone: string,
  otp: string,
  requestId?: string
): Promise<VerifyOtpResponse> {
  const base = apiBase();
  if (!base) throw new Error('API URL not set. Set EXPO_PUBLIC_API_URL in .env and restart Expo.');
  try {
    const res = await fetchWithTimeout(`${base}/auth/customer/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phone.trim(),
        otp,
        requestId: requestId ?? phone.trim(),
      }),
    });
    if (!res.ok) {
      const msg = await parseErrorResponse(res);
      throw new Error(msg);
    }
    return res.json() as Promise<VerifyOtpResponse>;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Verification timed out. Check network and try again.');
    }
    if (err instanceof Error && (err.message === 'Network request failed' || err.message.includes('Network'))) {
      throw new Error('Cannot reach server. Check EXPO_PUBLIC_API_URL and WiFi.');
    }
    throw err;
  }
}

export interface ActiveSubscriptionItem {
  id: string;
  planId: string;
  planName: string;
  planDescription?: string | null;
  /** Address this subscription is tied to (pickup/delivery only at this address). */
  addressId: string | null;
  /** Address label at purchase; still shown after address is edited/deleted. */
  addressLabel?: string | null;
  validityStartDate: string;
  validTill: string;
  remainingPickups: number;
  remainingKg: number | null;
  remainingItems: number | null;
  maxPickups: number;
  kgLimit: number | null;
  itemsLimit: number | null;
  hasActiveOrder: boolean;
}

export interface PastSubscriptionItem {
  id: string;
  planId: string;
  planName: string;
  /** Address ID at purchase (may be deleted later). */
  addressId?: string | null;
  /** Address label at purchase; still shown after address is edited/deleted. */
  addressLabel?: string | null;
  validityStartDate: string;
  validTill: string;
  inactivatedAt: string;
  remainingPickups: number;
  usedPickups: number;
  maxPickups: number;
  usedKg: number;
  usedItemsCount: number;
  kgLimit: number | null;
  itemsLimit: number | null;
}

export interface MeResponse {
  user: { id: string; phone: string | null; role: string; name: string | null; email: string | null };
  defaultAddress?: { id: string; pincode: string };
  activeSubscriptions?: ActiveSubscriptionItem[];
  pastSubscriptions?: PastSubscriptionItem[];
  activeSubscription?: ActiveSubscriptionItem;
}

export async function getMe(token: string): Promise<MeResponse> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  try {
    const res = await fetchWithTimeout(`${base}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to load profile');
    return res.json() as Promise<MeResponse>;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check network and try again.');
    }
    throw err;
  }
}

export async function updateMe(
  token: string,
  body: { name?: string; email?: string }
): Promise<void> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const res = await fetchWithTimeout(`${base}/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(err.message ?? 'Failed to update profile');
  }
}

/** Register Expo push token so the backend can send lock-screen notifications (booking confirmed, order picked up, invoice, payment, delivered, etc.). */
export async function registerPushToken(token: string, pushToken: string): Promise<{ ok: boolean }> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const res = await fetchWithTimeout(`${base}/me/push-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pushToken }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(err.message ?? 'Failed to register push token');
  }
  return res.json() as Promise<{ ok: boolean }>;
}

export interface BackendAddress {
  id: string;
  userId: string;
  label: string;
  addressLine: string;
  houseNo?: string | null;
  streetArea?: string | null;
  city?: string | null;
  pincode: string;
  isDefault: boolean;
  googleMapUrl?: string | null;
}

export async function listAddresses(token: string): Promise<BackendAddress[]> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const res = await fetchWithTimeout(`${base}/addresses`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load addresses');
  return res.json() as Promise<BackendAddress[]>;
}

export async function createAddress(
  token: string,
  body: {
    label: string;
    addressLine: string;
    pincode: string;
    isDefault?: boolean;
    googleMapUrl?: string | null;
    houseNo?: string | null;
    streetArea?: string | null;
    city?: string | null;
  }
): Promise<{ id: string; pincode: string }> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const res = await fetchWithTimeout(`${base}/addresses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(err.message ?? 'Failed to save address');
  }
  return res.json() as Promise<{ id: string; pincode: string }>;
}

export async function updateAddress(
  token: string,
  id: string,
  body: {
    label?: string;
    addressLine?: string;
    pincode?: string;
    isDefault?: boolean;
    googleMapUrl?: string | null;
    houseNo?: string | null;
    streetArea?: string | null;
    city?: string | null;
  }
): Promise<BackendAddress> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const res = await fetchWithTimeout(`${base}/addresses/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(err.message ?? 'Failed to update address');
  }
  return res.json() as Promise<BackendAddress>;
}

export async function deleteAddress(token: string, id: string): Promise<void> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const res = await fetchWithTimeout(`${base}/addresses/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(err.message ?? 'Failed to delete address');
  }
}

// --- Serviceability & feedback (no auth) ---
export interface ServiceabilityResult {
  pincode: string;
  serviceable: boolean;
  message?: string;
  /** Set when serviceable; branch that serves this pincode. */
  branchId?: string | null;
  branchName?: string | null;
}

export async function checkServiceability(pincode: string): Promise<ServiceabilityResult> {
  const base = apiBase();
  if (!base) {
    return { pincode, serviceable: false, message: 'Backend not linked. Set EXPO_PUBLIC_API_URL in .env and restart the app.' };
  }
  const res = await fetchWithTimeout(`${base}/serviceability?pincode=${encodeURIComponent(pincode)}`);
  const data = (await res.json()) as ServiceabilityResult & { message?: string[]; statusCode?: number };
  if (!res.ok) {
    const msg =
      Array.isArray(data.message) ? data.message.join(', ')
        : typeof (data as { message?: unknown }).message === 'string' ? ((data as { message: string }).message)
          : 'Request failed';
    return { pincode, serviceable: false, message: msg };
  }
  return {
    pincode,
    serviceable: data.serviceable,
    message: data.message,
    branchId: data.branchId ?? undefined,
    branchName: data.branchName ?? undefined,
  };
}

// --- Slot availability (public) ---
export interface SlotAvailability {
  isServiceable: boolean;
  isHoliday: boolean;
  branchName?: string;
  operatingHours?: { startTime: string; endTime: string };
  timeSlots: string[];
}

export async function getSlotAvailability(
  pincode: string,
  date: string
): Promise<SlotAvailability> {
  const base = apiBase();
  if (!base) {
    return { isServiceable: false, isHoliday: false, timeSlots: [] };
  }
  const res = await fetchWithTimeout(
    `${base}/slots/availability?pincode=${encodeURIComponent(pincode)}&date=${encodeURIComponent(date)}`
  );
  const data = (await res.json()) as SlotAvailability;
  return data;
}

// --- Subscription plans (customer JWT) ---
export interface AvailablePlanItem {
  id: string;
  name: string;
  description: string | null;
  redemptionMode: string;
  variant: string;
  validityDays: number;
  maxPickups: number;
  kgLimit: number | null;
  itemsLimit: number | null;
  pricePaise: number;
  isRedeemable: boolean;
  reason?: 'ALREADY_REDEEMED';
  /** Empty = plan for all branches. Non-empty = plan only for these branch IDs. */
  branchIds?: string[];
}

export async function getAvailablePlans(token: string): Promise<AvailablePlanItem[]> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const res = await fetchWithTimeout(`${base}/subscriptions/plans/available`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load subscription plans');
  return res.json() as Promise<AvailablePlanItem[]>;
}

export interface PurchaseSubscriptionResult {
  subscriptionId: string;
  planName: string;
  validityStartDate: string;
  validTill: string;
  remainingPickups: number;
}

export async function purchaseSubscription(
  token: string,
  planId: string,
  addressId: string
): Promise<PurchaseSubscriptionResult> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const res = await fetchWithTimeout(`${base}/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ planId, addressId }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string; code?: string };
    throw new Error(err.message ?? 'Purchase failed');
  }
  return res.json() as Promise<PurchaseSubscriptionResult>;
}

/** Subscription detail for Plans → tap on a plan (active or completed). */
export interface SubscriptionDetailResponse {
  id: string;
  planId: string;
  planName: string | null;
  planDescription: string | null;
  active: boolean;
  validityStartDate: string;
  validTill: string;
  remainingPickups: number;
  remainingKg: number | null;
  remainingItems: number | null;
  maxPickups: number;
  kgLimit: number | null;
  itemsLimit: number | null;
  usedKg: number;
  usedItemsCount: number;
  addressId: string | null;
  /** PAID = admin confirmed payment; DUE = not yet confirmed. */
  paymentStatus: 'PAID' | 'DUE';
  invoice: { id: string; code: string; pdfUrl: string | null; issuedAt: string | null } | null;
}

export async function getSubscriptionDetail(token: string, subscriptionId: string): Promise<SubscriptionDetailResponse | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await fetchWithTimeout(`${base}/subscriptions/${subscriptionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<SubscriptionDetailResponse>;
}

// --- Orders (customer JWT) ---
export interface OrderSummary {
  id: string;
  status: string;
  serviceType: string;
  orderType?: string;
  orderSource?: string | null;
  subscriptionId?: string | null;
  pickupDate: string;
  timeWindow: string;
  createdAt: string;
  /** Amount to collect (paise); from final invoice when issued, else ACK. */
  amountToPayPaise?: number | null;
  /** Payment status: CAPTURED = paid, PENDING/DUE = unpaid, FAILED = payment failed. */
  paymentStatus?: string;
  /** Address ID for this order (used to block edit/delete of address when it has active orders). */
  addressId?: string;
  /** Address label at order time (shown even after address is edited/deleted). */
  addressLabel?: string | null;
  /** Full address line at order time (shown even after address is edited/deleted). */
  addressLine?: string | null;
  /** Subscription utilisation from invoice (ACK or final): weight in kg. */
  subscriptionUsageKg?: number | null;
  /** Subscription utilisation from invoice: items count. */
  subscriptionUsageItems?: number | null;
}

export interface OrderDetail extends OrderSummary {
  orderType: string;
  serviceTypes: string[];
  addressId: string;
  addressLabel?: string | null;
  addressLine?: string | null;
  pincode: string;
  estimatedWeightKg: number | null;
  actualWeightKg: number | null;
  confirmedAt: string | null;
  pickedUpAt: string | null;
  inProgressAt: string | null;
  readyAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  /** CAPTURED = paid. */
  paymentStatus?: string;
}

/** Invoice line item (amounts in paise). icon from catalog (preset key or URL path). */
export interface OrderInvoiceItem {
  id: string;
  type: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  catalogItemId?: string | null;
  icon?: string | null;
  /** Optional catalog-matrix info (when invoice line is tied to a segment/service category). */
  segmentCategoryId?: string | null;
  segmentLabel?: string | null;
  serviceCategoryId?: string | null;
  serviceLabel?: string | null;
}

export interface OrderInvoice {
  id: string;
  code?: string | null;
  type: string;
  status: string;
  subtotal?: number;
  tax?: number;
  total: number;
  discountPaise?: number;
  issuedAt: string | null;
  pdfUrl: string;
  branchAddress?: string | null;
  branchEmail?: string | null;
  branchPhone?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  footerNote?: string | null;
  items?: OrderInvoiceItem[];
}

export interface CustomerPriceListLine {
  segment: string;
  service: string;
  priceRupees: number;
}

export interface CustomerPriceListItem {
  itemId: string;
  name: string;
  icon?: string | null;
  lines: CustomerPriceListLine[];
}

export async function createOrder(
  token: string,
  body: {
    addressId: string;
    pickupDate: string;
    timeWindow: string;
    selectedServices?: string[];
    estimatedWeightKg?: number;
    /** For subscription booking: use existing subscription. */
    orderType?: 'INDIVIDUAL' | 'SUBSCRIPTION';
    subscriptionId?: string | null;
  }
): Promise<{ orderId: string }> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const orderType = body.orderType ?? (body.subscriptionId ? 'SUBSCRIPTION' : 'INDIVIDUAL');
  const payload: Record<string, unknown> = {
    orderType,
    addressId: body.addressId,
    pickupDate: body.pickupDate,
    timeWindow: body.timeWindow,
    estimatedWeightKg: body.estimatedWeightKg ?? undefined,
  };
  if (orderType === 'SUBSCRIPTION' && body.subscriptionId) {
    payload.subscriptionId = body.subscriptionId;
  } else {
    payload.selectedServices = body.selectedServices ?? ['WASH_FOLD'];
  }
  const res = await fetchWithTimeout(`${base}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json()) as { message?: string; error?: { message?: string | string[] } };
    const msg = body?.error?.message ?? body?.message;
    const str = Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to create order');
    throw new Error(str);
  }
  return res.json() as Promise<{ orderId: string }>;
}

export async function listOrders(token: string): Promise<OrderSummary[]> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const res = await fetchWithTimeout(`${base}/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load orders');
  return res.json() as Promise<OrderSummary[]>;
}

export async function getOrder(token: string, orderId: string): Promise<OrderDetail> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const res = await fetchWithTimeout(`${base}/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load order');
  return res.json() as Promise<OrderDetail>;
}

export async function listOrderInvoices(
  token: string,
  orderId: string
): Promise<OrderInvoice[]> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const res = await fetchWithTimeout(`${base}/orders/${orderId}/invoices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load invoices');
  return res.json() as Promise<OrderInvoice[]>;
}

export async function listPriceList(token: string): Promise<CustomerPriceListItem[]> {
  const base = apiBase();
  if (!base) throw new Error('API URL not set. Set EXPO_PUBLIC_API_URL in .env and restart Expo.');
  const res = await fetchWithTimeout(`${base}/items/price-list`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const msg = await parseErrorResponse(res);
    throw new Error(msg);
  }
  return res.json() as Promise<CustomerPriceListItem[]>;
}

// --- Order feedback (customer) ---
export interface OrderFeedbackEligibilityResponse {
  eligible: boolean;
  reason?: string;
  alreadySubmitted: boolean;
}

export interface OrderFeedbackSubmissionResponse {
  id: string;
  orderId: string | null;
  type: string;
  rating: number | null;
  status: string;
  createdAt: string;
}

export async function checkOrderFeedbackEligibility(
  token: string,
  orderId: string,
): Promise<OrderFeedbackEligibilityResponse> {
  const base = apiBase();
  if (!base) throw new Error('API URL not set. Set EXPO_PUBLIC_API_URL in .env and restart Expo.');
  const res = await fetchWithTimeout(`${base}/orders/${orderId}/feedback/eligibility`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Failed to check feedback eligibility');
  }
  return res.json() as Promise<OrderFeedbackEligibilityResponse>;
}

export async function submitOrderFeedback(
  token: string,
  orderId: string,
  body: { rating: number; message?: string },
): Promise<OrderFeedbackSubmissionResponse> {
  const base = apiBase();
  if (!base) throw new Error('API URL not set. Set EXPO_PUBLIC_API_URL in .env and restart Expo.');
  const payload = {
    rating: body.rating,
    message: body.message?.trim() ? body.message.trim() : undefined,
  };
  const res = await fetchWithTimeout(`${base}/orders/${orderId}/feedback`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errBody?.message ?? 'Failed to submit feedback');
  }
  return res.json() as Promise<OrderFeedbackSubmissionResponse>;
}

/** Full URL to open invoice PDF (used with Bearer token). */
export function invoicePdfUrl(invoiceId: string): string {
  const base = apiBase();
  return base ? `${base}/invoices/${invoiceId}/pdf` : '';
}

/** Fetch invoice PDF with auth and return as base64 for in-app preview (WebView often cannot display PDF from URL on mobile). */
export async function fetchInvoicePdfBase64(invoiceId: string, token: string): Promise<string> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const url = `${base}/invoices/${invoiceId}/pdf`;
  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load invoice');
  const arrayBuffer = await res.arrayBuffer();
  const base64Module = await import('base64-arraybuffer').catch(() => null);
  const encodeBase64 = base64Module?.encode;
  if (typeof encodeBase64 !== 'function') throw new Error('Failed to load PDF encoder');
  return encodeBase64(arrayBuffer);
}

export async function submitAreaRequest(body: {
  pincode: string;
  addressLine: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}): Promise<{ id: string; status: string }> {
  const base = apiBase();
  if (!base) throw new Error('API URL not configured');
  const res = await fetchWithTimeout(`${base}/feedback/area-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(err.message ?? 'Failed to submit request');
  }
  return res.json() as Promise<{ id: string; status: string }>;
}

