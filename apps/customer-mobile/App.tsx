import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import krackbotLogo from './assets/krackbot-logo.png';
import washAndFoldIcon from './assets/service-icons/wash-and-fold.png';
import washAndIronIcon from './assets/service-icons/wash-and-iron.png';
import dryCleaningIcon from './assets/service-icons/dry-cleaning.png';
import shoeCleaningIcon from './assets/service-icons/shoe-cleaning.png';
import steamIronIcon from './assets/service-icons/steam-iron.png';
import homeLinenIcon from './assets/service-icons/home-linen.png';
import { checkApiConnection } from './src/config/api';
import {
  checkServiceability,
  submitAreaRequest,
  requestOtp,
  verifyOtp,
  getMe,
  updateMe,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  getSlotAvailability,
  getBranchesForPincode,
  createOrder,
  listOrders,
  getOrder,
  listOrderInvoices,
  checkOrderFeedbackEligibility,
  submitOrderFeedback,
  fetchInvoicePdfBase64,
  getPublicBranding,
  brandingLogoFullUrl,
  brandingWelcomeBackgroundFullUrl,
  getPublicCarousel,
  carouselImageFullUrl,
  listPriceList,
  registerPushToken,
  type BackendAddress,
  type CustomerPriceListItem,
  type PublicBrandingResponse,
  type OrderSummary,
  type OrderDetail,
  type OrderInvoice,
  type BranchForPincodeOption,
  type ActiveSubscriptionItem,
  type PastSubscriptionItem,
  getSubscriptionDetail,
  type SubscriptionDetailResponse,
} from './src/api';
import { getStoredToken, setStoredToken, clearStoredToken } from './src/authStorage';
import { SERVICE_TYPES, type ServiceTypeId } from './src/types';
import { parseLatLngFromMapsUrl, reverseGeocodeAddress } from './src/googlePlaces';

type Step = 'phone' | 'otp' | 'profile' | 'done';
type HomeScreen = 'home' | 'branches' | 'subscriptionDetail' | 'addresses' | 'addAddress' | 'areaRequestSent' | 'bookPickup' | 'myOrders' | 'orderDetail' | 'profile';
type OrderFilter = 'all' | 'walk_in' | 'individual' | 'subscription';
type BookingStep = 'services' | 'address' | 'branch' | 'date' | 'time' | 'confirm';

const SERVICE_ICON_SOURCE: Record<ServiceTypeId, any> = {
  WASH_FOLD: washAndFoldIcon,
  WASH_IRON: washAndIronIcon,
  DRY_CLEAN: dryCleaningIcon,
  SHOES: shoeCleaningIcon,
  STEAM_IRON: steamIronIcon,
  HOME_LINEN: homeLinenIcon,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Darkest login gradient stop — fills safe areas, edge-to-edge gaps, and PWA/browser overscan. */
const AUTH_SCREEN_BACKGROUND = '#3d0f3d';

function orderStatusLabel(status: string): string {
  const s = (status || '').toUpperCase().replace(/-/g, '_');
  const map: Record<string, string> = {
    BOOKING_CONFIRMED: 'Booking confirmed',
    PICKUP_SCHEDULED: 'Scheduled Pick up',
    PICKED_UP: 'Picked up',
    IN_PROCESSING: 'In progress',
    READY: 'Ready',
    OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  };
  return map[s] ?? status;
}

function serviceTypeDisplayLabel(serviceType: string): string {
  const s = (serviceType || '').toUpperCase().replace(/-/g, '_').trim();
  const map: Record<string, string> = {
    WASH_FOLD: 'Wash and Fold',
    WASH_IRON: 'Wash and Iron',
    DRY_CLEAN: 'Dry cleaning',
    STEAM_IRON: 'Steam Iron',
    SHOES: 'Shoes',
    HOME_LINEN: 'Home linen',
    ADD_ONS: 'Add-ons',
  };
  return (map[s] ?? String(serviceType)).replace(/_/g, ' ');
}

/** YYYY-MM-DD in local time (avoids UTC off-by-one when user selects e.g. 25 Feb). */
function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function App() {
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const isDesktopWeb = Platform.OS === 'web' && windowWidth >= 1024;
  const desktopMobileFrameWidth = 390;
  const appScreenWidth = isDesktopWeb ? desktopMobileFrameWidth : windowWidth;
  const [step, setStep] = useState<Step>('phone');
  const [initializing, setInitializing] = useState(true);
  const [homeScreen, setHomeScreen] = useState<HomeScreen>('home');

  const [countryCode, setCountryCode] = useState('+91');
  const [mobile, setMobile] = useState('');
  const phone = (countryCode.trim().startsWith('+') ? countryCode.trim() : '+' + countryCode.trim()) + mobile.replace(/\D/g, '');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [token, setToken] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<ServiceTypeId[]>([]);
  const [addresses, setAddresses] = useState<BackendAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addAddressLabel, setAddAddressLabel] = useState('');
  const [addAddressLine, setAddAddressLine] = useState('');
  const [addHouseNo, setAddHouseNo] = useState('');
  const [addStreetArea, setAddStreetArea] = useState('');
  const [addCity, setAddCity] = useState('');
  const [addPincode, setAddPincode] = useState('');
  const [addGoogleUrl, setAddGoogleUrl] = useState('');
  const [showGoogleMapsPicker, setShowGoogleMapsPicker] = useState(false);
  const [lastGoogleMapsUrl, setLastGoogleMapsUrl] = useState('');
  const [addFromMapsLoading, setAddFromMapsLoading] = useState(false);
  const [addIsDefault, setAddIsDefault] = useState(false);
  const [serviceability, setServiceability] = useState<{ serviceable: boolean; message?: string } | null>(null);
  const [checkingServiceability, setCheckingServiceability] = useState(false);
  const lastCheckedPincodeRef = useRef<string | null>(null);
  const [areaRequestSent, setAreaRequestSent] = useState(false);
  const [bookingStep, setBookingStep] = useState<BookingStep>('address');
  const [bookingAddressId, setBookingAddressId] = useState<string | null>(null);
  const [bookingAddress, setBookingAddress] = useState<BackendAddress | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [webDatePickerVisible, setWebDatePickerVisible] = useState(false);
  const [webCalendarMonth, setWebCalendarMonth] = useState<Date>(new Date());
  const [webHolidayDates, setWebHolidayDates] = useState<Record<string, true>>({});
  const [webHolidayLoading, setWebHolidayLoading] = useState(false);
  const [bookingTimeSlot, setBookingTimeSlot] = useState('');
  const [slotAvailability, setSlotAvailability] = useState<{
    isHoliday: boolean;
    timeSlots: string[];
    branchName?: string;
  } | null>(null);
  const [slotAvailabilityLoading, setSlotAvailabilityLoading] = useState(false);
  const [bookingBranchesLoading, setBookingBranchesLoading] = useState(false);
  const [bookingBranches, setBookingBranches] = useState<
    Array<{ id: string; name: string; logoUrl: string | null; updatedAt: string | null }>
  >([]);
  const [bookingSelectedBranchId, setBookingSelectedBranchId] = useState<string | null>(null);
  const [bookingSuccessOrderId, setBookingSuccessOrderId] = useState<string | null>(null);
  const [orders, setOrdersList] = useState<OrderSummary[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [orderInvoices, setOrderInvoices] = useState<OrderInvoice[]>([]);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [meData, setMeData] = useState<{ activeSubscriptions: ActiveSubscriptionItem[]; pastSubscriptions: PastSubscriptionItem[] } | null>(null);
  /** Selected saved address on Branches tab (pincode used to list branches). */
  const [branchesAddressId, setBranchesAddressId] = useState<string | null>(null);
  const [branchesForPincode, setBranchesForPincode] = useState<BranchForPincodeOption[]>([]);
  const [branchesListLoading, setBranchesListLoading] = useState(false);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [subscriptionDetail, setSubscriptionDetail] = useState<SubscriptionDetailResponse | null>(null);
  const [subscriptionDetailLoading, setSubscriptionDetailLoading] = useState(false);
  const [subscriptionInvoicePreviewUri, setSubscriptionInvoicePreviewUri] = useState<string | null>(null);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [priceListModalVisible, setPriceListModalVisible] = useState(false);
  const [priceListLoading, setPriceListLoading] = useState(false);
  const [priceListError, setPriceListError] = useState<string | null>(null);
  const [priceListItems, setPriceListItems] = useState<CustomerPriceListItem[]>([]);
  const [subscriptionInvoiceLoading, setSubscriptionInvoiceLoading] = useState(false);
  const [subscriptionInvoiceError, setSubscriptionInvoiceError] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [bookingSubscriptionId, setBookingSubscriptionId] = useState<string | null>(null);
  const [bookingSubscriptionValidFrom, setBookingSubscriptionValidFrom] = useState<string | null>(null);
  const [bookingSubscriptionValidTill, setBookingSubscriptionValidTill] = useState<string | null>(null);
  /** Ref so address step knows we came from subscription even if state was reset (e.g. hot reload). */
  const bookingFromSubscriptionRef = useRef(false);
  const [returnToBookPickupAddress, setReturnToBookPickupAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    return () => sub.remove();
  }, []);

  // --- Order feedback (shown after DELIVERED + CAPTURED) ---
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const feedbackEligibilityCheckedForOrderIdRef = useRef<string | null>(null);
  const feedbackEligibilityInFlightForOrderIdRef = useRef<string | null>(null);
  const feedbackSubmittedForOrderIdRef = useRef<string | null>(null);
  /** Exclude walk-in addresses from saved-address lists (backend may set source: 'WALK_IN'). */
  const savedAddresses = useMemo(
    () => addresses.filter((a) => (a as BackendAddress & { source?: string }).source !== 'WALK_IN'),
    [addresses]
  );

  /** Address IDs that have at least one active order (not DELIVERED/CANCELLED). Used to block edit/delete. */
  const addressIdsWithActiveOrder = useMemo(() => {
    const active = orders.filter((o) => {
      const s = (o.status || '').toUpperCase();
      return s !== 'DELIVERED' && s !== 'CANCELLED';
    });
    const ids = new Set<string>();
    active.forEach((o) => {
      const aid = (o as OrderSummary & { addressId?: string }).addressId;
      if (aid) ids.add(aid);
    });
    return ids;
  }, [orders]);

  /** Address IDs that have an active subscription. Used to block edit/delete (address cannot be changed while subscription is active). */
  const addressIdsWithActiveSubscription = useMemo(() => {
    const ids = new Set<string>();
    (meData?.activeSubscriptions ?? []).forEach((s) => {
      const aid = (s as ActiveSubscriptionItem).addressId;
      if (aid) ids.add(aid);
    });
    return ids;
  }, [meData?.activeSubscriptions]);

  /** Subscription IDs that have an active order (not DELIVERED/CANCELLED). User cannot start a new booking with these until the order is complete. */
  const subscriptionIdsWithActiveOrder = useMemo(() => {
    const ids = new Set<string>();
    orders.forEach((o) => {
      const s = (o.status || '').toUpperCase();
      if (s !== 'DELIVERED' && s !== 'CANCELLED' && o.subscriptionId) {
        ids.add(o.subscriptionId);
      }
    });
    return ids;
  }, [orders]);

  /** Notifications derived from orders and subscriptions (booking confirmed, picked up, invoice, payment, delivered, subscription activated). */
  const notificationsList = useMemo(() => {
    type Notif = { id: string; title: string; body: string; sortDate: string; orderId?: string; subscriptionId?: string };
    const list: Notif[] = [];
    const statusToTitle: Record<string, string> = {
      BOOKING_CONFIRMED: 'Booking confirmed',
      PICKUP_SCHEDULED: 'Booking confirmed',
      PICKED_UP: 'Order picked up',
      IN_PROCESSING: 'In progress',
      READY: 'Order ready',
      OUT_FOR_DELIVERY: 'Out for delivery',
      DELIVERED: 'Delivered',
      CANCELLED: 'Order cancelled',
    };
    orders.forEach((o) => {
      const s = (o.status || '').toUpperCase().replace(/-/g, '_');
      const created = o.createdAt || '';
      const orderLabel = `Order #${(o.id || '').slice(-8)}`;
      const title = statusToTitle[s] || o.status || 'Order update';
      list.push({ id: `order-${o.id}-status`, title, body: orderLabel, sortDate: created, orderId: o.id });
      if (s !== 'CANCELLED' && (o.paymentStatus || '').toUpperCase() === 'CAPTURED') {
        list.push({ id: `order-${o.id}-payment`, title: 'Payment recorded', body: orderLabel, sortDate: created, orderId: o.id });
      }
      if (['IN_PROCESSING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(s)) {
        list.push({ id: `order-${o.id}-ack`, title: 'Acknowledgement invoice available', body: orderLabel, sortDate: created, orderId: o.id });
      }
    });
    (meData?.activeSubscriptions ?? []).forEach((sub) => {
      list.push({
        id: `sub-${sub.id}`,
        title: 'Subscription activated',
        body: sub.planName || 'Plan',
        sortDate: sub.validityStartDate || sub.validTill || '',
        subscriptionId: sub.id,
      });
    });
    list.sort((a, b) => (a.sortDate > b.sortDate ? -1 : a.sortDate < b.sortDate ? 1 : 0));
    return list;
  }, [orders, meData?.activeSubscriptions]);

  const openPriceListModal = useCallback(async () => {
    setPriceListModalVisible(true);
    if (!token) return;
    try {
      setPriceListLoading(true);
      setPriceListError(null);
      const rows = await listPriceList(token);
      setPriceListItems(rows);
    } catch (e) {
      setPriceListError(e instanceof Error ? e.message : 'Failed to load price list');
    } finally {
      setPriceListLoading(false);
    }
  }, [token]);

  /** Prefill houseNo, streetArea, city for edit: use stored fields when present, else parse from addressLine. */
  const prefillAddressFields = useCallback((a: BackendAddress) => {
    const h = (a.houseNo != null && String(a.houseNo).trim() !== '') ? String(a.houseNo).trim() : '';
    const s = (a.streetArea != null && String(a.streetArea).trim() !== '') ? String(a.streetArea).trim() : '';
    const c = (a.city != null && String(a.city).trim() !== '') ? String(a.city).trim() : '';
    if (h !== '' || s !== '' || c !== '') return { houseNo: h, streetArea: s, city: c };
    const line = (a.addressLine != null && String(a.addressLine).trim() !== '') ? String(a.addressLine).trim() : '';
    const parts = line.split(',').map((p: string) => p.trim()).filter(Boolean);
    return {
      houseNo: parts.length >= 1 ? parts[0] : '',
      streetArea: parts.length >= 2 ? parts[1] : '',
      city: parts.length >= 1 ? parts[parts.length - 1] : '',
    };
  }, []);

  const [welcomeBranding, setWelcomeBranding] = useState<PublicBrandingResponse | null>(null);
  const [acceptedTermsAndPrivacy, setAcceptedTermsAndPrivacy] = useState(false);
  const [legalModalContent, setLegalModalContent] = useState<{ title: string; body: string } | null>(null);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [userPhone, setUserPhone] = useState<string>('');
  const [carouselImageUrls, setCarouselImageUrls] = useState<string[]>([]);
  const [homeRefreshing, setHomeRefreshing] = useState(false);
  const carouselScrollRef = useRef<ScrollView>(null);
  const carouselPageRef = useRef(0);
  const googleMapsWebViewRef = useRef<WebView>(null);
  const onMapsUrlReceivedRef = useRef<((url: string) => void) | null>(null);
  const webHolidayCacheRef = useRef<Record<string, Record<string, true>>>({});

  useEffect(() => {
    if (step === 'phone') {
      getPublicBranding().then(setWelcomeBranding);
      setAcceptedTermsAndPrivacy(false);
    }
    if (step === 'done') {
      getPublicBranding().then(setWelcomeBranding);
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'done') return;
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        getPublicBranding().then(setWelcomeBranding);
      }
    });
    return () => sub.remove();
  }, [step]);

  /** PWA / web: tab favicon from Admin Branding app icon (else logo). Fixes dev + stale bundled favicon.ico. */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const win = (globalThis as { window?: Window & { document?: Document } }).window;
    const doc = win?.document;
    if (!doc?.head) return;
    const raw = welcomeBranding?.appIconUrl || welcomeBranding?.logoUrl;
    const href = brandingLogoFullUrl(raw ?? null);
    if (!href) return;
    doc.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((node) => {
      const el = node as HTMLLinkElement;
      el.href = href;
      el.type = 'image/png';
    });
    if (!doc.querySelector('link[rel="icon"]')) {
      const el = doc.createElement('link');
      el.rel = 'icon';
      el.type = 'image/png';
      el.href = href;
      doc.head.appendChild(el);
    }
    let apple = doc.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (!apple) {
      apple = doc.createElement('link');
      apple.rel = 'apple-touch-icon';
      doc.head.appendChild(apple);
    }
    apple.href = href;
  }, [welcomeBranding?.appIconUrl, welcomeBranding?.logoUrl]);

  // Set up Android notification channel
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      }).catch(() => {});
    }
  }, []);

  // Register for push notifications when user is logged in
  useEffect(() => {
    if (step !== 'done' || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const DeviceModule = await import('expo-device').catch(() => null);
        if (!DeviceModule) return;
        const Device = DeviceModule.default ?? DeviceModule;
        if (!Device?.isDevice) return;
        const { status: existing } = await Notifications.getPermissionsAsync();
        let final = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          final = status;
        }
        if (final !== 'granted' || cancelled) return;
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'a3ee3cc2-2e62-4325-a33e-93842c502157',
        });
        const pushToken = tokenData?.data;
        if (pushToken && !cancelled) await registerPushToken(token, pushToken);
      } catch (_) {
        // Notifications not available (e.g. web) or permission denied
      }
    })();
    return () => { cancelled = true; };
  }, [step, token]);

  // Handle notification tap — navigate to relevant screen
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data?.orderId && step === 'done') {
        setHomeScreen('orderDetail');
      }
    });
    return () => sub.remove();
  }, [step]);

  const fetchCarousel = useCallback(() => {
    getPublicCarousel().then((r) => setCarouselImageUrls(r.imageUrls ?? []));
  }, []);

  useEffect(() => {
    if (step === 'done' && homeScreen === 'home') {
      fetchCarousel();
    }
  }, [step, homeScreen, fetchCarousel]);

  useEffect(() => {
    carouselPageRef.current = 0;
  }, [carouselImageUrls.length]);

  const onHomeRefresh = useCallback(() => {
    setHomeRefreshing(true);
    Promise.all([getPublicCarousel(), getPublicBranding()])
      .then(([carouselRes, branding]) => {
        setCarouselImageUrls(carouselRes.imageUrls ?? []);
        setWelcomeBranding(branding);
      })
      .finally(() => setHomeRefreshing(false));
  }, []);

  useEffect(() => {
    if (step !== 'done' || homeScreen !== 'home') return;
    const pollMs = 30 * 1000;
    const id = setInterval(fetchCarousel, pollMs);
    return () => clearInterval(id);
  }, [step, homeScreen, fetchCarousel]);

  useEffect(() => {
    if (step !== 'done' || homeScreen !== 'home') return;
    const total = carouselImageUrls.length > 0 ? carouselImageUrls.length : 3;
    if (total <= 1) return;
    const winW = appScreenWidth;
    const id = setInterval(() => {
      const next = (carouselPageRef.current + 1) % total;
      carouselPageRef.current = next;
      carouselScrollRef.current?.scrollTo({
        x: next * winW,
        animated: true,
      });
    }, 5000);
    return () => clearInterval(id);
  }, [step, homeScreen, carouselImageUrls.length]);

  const fetchAddresses = useCallback(async () => {
    if (!token) return;
    setAddressesLoading(true);
    try {
      const data = await listAddresses(token);
      const filtered = data.filter((a) => {
        const normalized = (a.label ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
        return normalized !== 'walkin';
      });
      setAddresses(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load addresses');
    } finally {
      setAddressesLoading(false);
    }
  }, [token]);

  const applyGoogleMapsUrlToAddress = useCallback(async (url: string) => {
    const finalUrl = (url || '').trim();
    if (!finalUrl) return;
    setAddGoogleUrl(finalUrl);
    const coords = parseLatLngFromMapsUrl(finalUrl);
    if (!coords) return;
    const result = await reverseGeocodeAddress(coords.lat, coords.lng);
    if (!result) return;
    setAddStreetArea([result.street, result.area].filter(Boolean).join(', '));
    setAddCity(result.city);
    setAddPincode(result.pincode);
    setAddAddressLine(result.addressLine);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const win = (globalThis as { window?: Window }).window;
    if (!win?.addEventListener) return;
    const applyPayload = (d: {
      houseNo?: string;
      streetArea?: string;
      city?: string;
      pincode?: string;
      addressLine?: string;
      googleUrl?: string;
    } | null | undefined) => {
      if (!d) return;
      if (typeof d.houseNo === 'string') setAddHouseNo(d.houseNo);
      if (typeof d.streetArea === 'string') setAddStreetArea(d.streetArea);
      if (typeof d.city === 'string') setAddCity(d.city);
      if (typeof d.pincode === 'string') setAddPincode(d.pincode.replace(/\D/g, '').slice(0, 6));
      if (typeof d.addressLine === 'string') setAddAddressLine(d.addressLine);
      if (typeof d.googleUrl === 'string') setAddGoogleUrl(d.googleUrl);
      setError(null);
    };
    const onPwaMapAddress = (evt: Event) => {
      const customEvt = evt as CustomEvent<{
        houseNo?: string;
        streetArea?: string;
        city?: string;
        pincode?: string;
        addressLine?: string;
        googleUrl?: string;
      }>;
      applyPayload(customEvt?.detail);
    };
    const readFromStorage = () => {
      try {
        const raw = win.localStorage?.getItem('weyou:pwa-map-address');
        if (!raw) return;
        const payload = JSON.parse(raw) as {
          houseNo?: string;
          streetArea?: string;
          city?: string;
          pincode?: string;
          addressLine?: string;
          googleUrl?: string;
        };
        win.localStorage?.removeItem('weyou:pwa-map-address');
        applyPayload(payload);
      } catch {
        /* ignore */
      }
    };
    win.addEventListener('weyou:pwa-map-address', onPwaMapAddress as EventListener);
    const id = win.setInterval(readFromStorage, 600);
    readFromStorage();
    return () => {
      win.removeEventListener('weyou:pwa-map-address', onPwaMapAddress as EventListener);
      win.clearInterval(id);
    };
  }, []);


  useEffect(() => {
    if (step === 'done' && homeScreen === 'addresses' && token) {
      fetchAddresses();
    }
  }, [step, homeScreen, token, fetchAddresses]);

  useEffect(() => {
    if (step === 'done' && homeScreen === 'branches' && token) {
      fetchAddresses();
    }
  }, [step, homeScreen, token, fetchAddresses]);

  useEffect(() => {
    if (step === 'done' && homeScreen === 'bookPickup' && bookingStep === 'address' && token) {
      fetchAddresses();
    }
  }, [step, homeScreen, bookingStep, token, fetchAddresses]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setOrdersLoading(true);
    try {
      const list = await listOrders(token);
      setOrdersList(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setOrdersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (step === 'done' && (homeScreen === 'home' || homeScreen === 'myOrders' || homeScreen === 'addresses') && token) {
      fetchOrders();
    }
  }, [step, homeScreen, token, fetchOrders]);

  useEffect(() => {
    if (step === 'done' && homeScreen === 'orderDetail' && token && selectedOrderId) {
      fetchAddresses();
      (async () => {
        try {
          const [order, invoices] = await Promise.all([
            getOrder(token, selectedOrderId),
            listOrderInvoices(token, selectedOrderId),
          ]);
          setOrderDetail(order);
          setOrderInvoices(invoices);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load order');
        }
      })();
    }
  }, [step, homeScreen, token, selectedOrderId, fetchAddresses]);

  // When an order is completed and paid, ask the customer for rating feedback (once per order).
  useEffect(() => {
    if (!token || !orderDetail || !selectedOrderId) return;
    if (step !== 'done' || homeScreen !== 'orderDetail') return;

    const status = String(orderDetail.status || '').toUpperCase();
    const paymentStatus = String(orderDetail.paymentStatus || '').toUpperCase();
    const isPaid = paymentStatus === 'CAPTURED' || paymentStatus === 'PAID';
    if (status !== 'DELIVERED' || !isPaid) return;

    if (feedbackSubmittedForOrderIdRef.current === selectedOrderId) return;
    if (feedbackEligibilityCheckedForOrderIdRef.current === selectedOrderId) return;
    if (feedbackEligibilityInFlightForOrderIdRef.current === selectedOrderId) return;

    let cancelled = false;
    (async () => {
      feedbackEligibilityInFlightForOrderIdRef.current = selectedOrderId;
      try {
        const eligibility = await checkOrderFeedbackEligibility(token, selectedOrderId);
        if (cancelled) return;
        feedbackEligibilityCheckedForOrderIdRef.current = selectedOrderId;
        if (eligibility.eligible && !eligibility.alreadySubmitted) {
          setFeedbackRating(null);
          setFeedbackComment('');
          setFeedbackError(null);
          setFeedbackModalVisible(true);
        }
      } catch (err) {
        // If eligibility check fails, still prompt to avoid missing feedback collection.
        // Backend will reject duplicate submits, so this fallback is safe.
        if (!cancelled) {
          setFeedbackRating(null);
          setFeedbackComment('');
          setFeedbackError(null);
          setFeedbackModalVisible(true);
        }
        if (feedbackEligibilityCheckedForOrderIdRef.current === selectedOrderId) {
          feedbackEligibilityCheckedForOrderIdRef.current = null;
        }
        if (feedbackEligibilityInFlightForOrderIdRef.current === selectedOrderId) {
          feedbackEligibilityInFlightForOrderIdRef.current = null;
        }
      } finally {
        if (feedbackEligibilityInFlightForOrderIdRef.current === selectedOrderId) {
          feedbackEligibilityInFlightForOrderIdRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, step, homeScreen, orderDetail, selectedOrderId]);

  const handleSubmitOrderFeedback = useCallback(async () => {
    if (!token || !selectedOrderId) return;
    if (feedbackRating == null) {
      setFeedbackError('Please select a star rating.');
      return;
    }
    setFeedbackError(null);
    setFeedbackSubmitting(true);
    try {
      await submitOrderFeedback(token, selectedOrderId, {
        rating: feedbackRating,
        message: feedbackComment || undefined,
      });
      feedbackSubmittedForOrderIdRef.current = selectedOrderId;
      feedbackEligibilityCheckedForOrderIdRef.current = selectedOrderId;
      setFeedbackModalVisible(false);
      Alert.alert('Thanks!', 'Your feedback has been submitted.');
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [token, selectedOrderId, feedbackRating, feedbackComment]);

  const fetchSubscriptionsData = useCallback(async () => {
    if (!token) return;
    try {
      const meRes = await getMe(token);
      setMeData({
        activeSubscriptions: meRes.activeSubscriptions ?? [],
        pastSubscriptions: meRes.pastSubscriptions ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account');
    }
  }, [token]);

  useEffect(() => {
    if (step === 'done' && (homeScreen === 'branches' || homeScreen === 'bookPickup') && token) {
      fetchSubscriptionsData();
    }
  }, [step, homeScreen, token, fetchSubscriptionsData]);

  // Default Branches tab address to first saved address when none selected
  useEffect(() => {
    if (homeScreen === 'branches' && savedAddresses.length > 0 && branchesAddressId == null) {
      setBranchesAddressId(savedAddresses[0].id);
    }
  }, [homeScreen, savedAddresses.length, branchesAddressId]);

  // Fetch subscription detail when user opens subscription detail screen
  useEffect(() => {
    if (homeScreen !== 'subscriptionDetail' || !selectedSubscriptionId || !token) return;
    let cancelled = false;
    setSubscriptionDetailLoading(true);
    setSubscriptionDetail(null);
    getSubscriptionDetail(token, selectedSubscriptionId)
      .then((d) => {
        if (!cancelled) {
          setSubscriptionDetail(d ?? null);
          setSubscriptionDetailLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) { setSubscriptionDetail(null); setSubscriptionDetailLoading(false); }
      });
    return () => { cancelled = true; };
  }, [homeScreen, selectedSubscriptionId, token]);

  // Load branches for selected address pincode on Branches tab
  useEffect(() => {
    if (homeScreen !== 'branches' || branchesAddressId == null) {
      setBranchesForPincode([]);
      return;
    }
    const addr = savedAddresses.find((a) => a.id === branchesAddressId);
    const pin = addr?.pincode?.trim();
    if (!pin) {
      setBranchesForPincode([]);
      return;
    }
    let cancelled = false;
    setBranchesListLoading(true);
    getBranchesForPincode(pin)
      .then((res) => {
        if (!cancelled) setBranchesForPincode(res.branches ?? []);
      })
      .catch(() => {
        if (!cancelled) setBranchesForPincode([]);
      })
      .finally(() => {
        if (!cancelled) setBranchesListLoading(false);
      });
    return () => { cancelled = true; };
  }, [homeScreen, branchesAddressId, savedAddresses]);

  // Startup: verify API connection and log result (no silent failures)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await checkApiConnection();
      if (mounted) {
        if (ok) {
          console.log('API Connected');
        } else {
          console.warn('API Not Connected');
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const INIT_TIMEOUT_MS = 12000; // Show welcome screen if token/API check hangs
  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      setInitializing(false);
      setStep('phone');
      setError('Could not reach the server. Check API URL and network, then tap Retry.');
    }, INIT_TIMEOUT_MS);
    (async () => {
      try {
        const storedToken = await getStoredToken();
        if (cancelled) return;
        if (!storedToken) {
          clearTimeout(timeoutId);
          setStep('phone');
          setInitializing(false);
          return;
        }
        const me = await getMe(storedToken);
        if (cancelled) return;
        clearTimeout(timeoutId);
        setToken(storedToken);
        setName(me.user.name ?? '');
        setEmail(me.user.email ?? '');
        setUserPhone(me.user.phone ?? '');
        if (me.user.name || me.user.email) {
          setStep('done');
        } else {
          setStep('profile');
        }
      } catch (err) {
        if (cancelled) return;
        clearTimeout(timeoutId);
        const isNetworkError =
          (err instanceof TypeError && (err.message === 'Network request failed' || err.message?.includes('fetch'))) ||
          (err instanceof Error && (err.message === 'Network request failed' || err.message?.includes('Network')));
        if (isNetworkError || (err instanceof Error && err.message?.includes('Failed to load'))) {
          await clearStoredToken();
          setToken(null);
          setStep('phone');
          setError('Could not reach the server. Check that the API is running and your device is on the same network, then tap Retry.');
        } else {
          setStep('phone');
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  const validatePhone = (combined: string): string | null => {
    const digits = combined.replace(/\D/g, '');
    if (digits.length < 10) {
      return 'Enter a valid mobile number (at least 10 digits).';
    }
    return null;
  };

  const validateOtp = (value: string): string | null => {
    if (value.length !== 6) {
      return 'OTP must be 6 digits.';
    }
    return null;
  };

  const hasLegalContent = Boolean(
    welcomeBranding?.termsAndConditions?.trim() || welcomeBranding?.privacyPolicy?.trim()
  );

  const handleRetryConnection = async () => {
    setError(null);
    setInitializing(true);
    try {
      const storedToken = await getStoredToken();
      if (storedToken) {
        const me = await getMe(storedToken);
        setToken(storedToken);
        setName(me.user.name ?? '');
        setEmail(me.user.email ?? '');
        setUserPhone(me.user.phone ?? '');
        if (me.user.name || me.user.email) {
          setStep('done');
        } else {
          setStep('profile');
        }
      } else {
        await getPublicBranding().then(setWelcomeBranding);
      }
    } catch (err) {
      const isNetworkError =
        (err instanceof TypeError && (err.message === 'Network request failed' || err.message?.includes('fetch'))) ||
        (err instanceof Error && (err.message === 'Network request failed' || err.message?.includes('Network')));
      if (isNetworkError || (err instanceof Error && err.message?.includes('Failed to load'))) {
        setError('Could not reach the server. Check that the API is running and your device is on the same network, then tap Retry.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      setInitializing(false);
    }
  };

  const handleRequestOtp = async () => {
    setError(null);
    const validationError = validatePhone(phone);
    if (validationError) {
      setError(validationError);
      Alert.alert('Invalid number', validationError);
      return;
    }
    if (hasLegalContent && !acceptedTermsAndPrivacy) {
      const msg = 'Please accept the Terms and conditions & Privacy policy to continue.';
      setError(msg);
      Alert.alert('Accept required', msg);
      return;
    }
    setLoading(true);
    try {
      const data = await requestOtp(phone.trim());
      const rid = data?.requestId ?? phone.trim();
      setRequestId(rid);
      setStep('otp');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP.';
      setError(message);
      Alert.alert('Could not send OTP', message, [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    const phoneError = validatePhone(phone);
    if (phoneError) {
      setError(phoneError);
      return;
    }
    const otpError = validateOtp(otp);
    if (otpError) {
      setError(otpError);
      return;
    }
    setLoading(true);
    try {
      const { token: newToken } = await verifyOtp(phone.trim(), otp, requestId ?? undefined);
      await setStoredToken(newToken);
      setToken(newToken);
      const me = await getMe(newToken);
      setName(me.user.name ?? '');
      setEmail(me.user.email ?? '');
      setUserPhone(me.user.phone ?? '');
      if (me.user.name || me.user.email) {
        setStep('done');
      } else {
        setStep('profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setError(null);
    const nameTrim = name.trim();
    const emailTrim = email.trim();
    if (!token) return;
    setLoading(true);
    try {
      await updateMe(token, {
        name: nameTrim || undefined,
        email: emailTrim || undefined,
      });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipProfile = async () => {
    setError(null);
    const nameTrim = name.trim();
    if (!token) {
      setStep('done');
      return;
    }
    setLoading(true);
    try {
      if (nameTrim) await updateMe(token, { name: nameTrim });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    try {
      await clearStoredToken();
      setToken(null);
      setCountryCode('+91');
      setMobile('');
      setOtp('');
      setRequestId(null);
      setName('');
      setEmail('');
      setStep('phone');
      setHomeScreen('home');
      setSelectedServiceIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log out.');
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (id: ServiceTypeId) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const checkPincodeServiceability = async () => {
    const pc = addPincode.trim().replace(/\D/g, '').slice(0, 6);
    if (pc.length !== 6) {
      setServiceability(null);
      return;
    }
    setCheckingServiceability(true);
    setServiceability(null);
    try {
      const result = await checkServiceability(pc);
      setServiceability({ serviceable: result.serviceable, message: result.message });
    } catch {
      setServiceability({ serviceable: false, message: 'Could not check serviceability' });
    } finally {
      setCheckingServiceability(false);
    }
  };

  useEffect(() => {
    const pc = addPincode.trim().replace(/\D/g, '').slice(0, 6);
    if (pc.length !== 6) {
      setServiceability(null);
      lastCheckedPincodeRef.current = null;
      return;
    }
    if (lastCheckedPincodeRef.current === pc) return;
    lastCheckedPincodeRef.current = pc;
    checkPincodeServiceability();
  }, [addPincode]);

  const handleSaveAddress = async () => {
    setError(null);
    const houseNo = addHouseNo.trim();
    const streetArea = addStreetArea.trim();
    const city = addCity.trim();
    const googleUrl = addGoogleUrl.trim();
    if (!houseNo) {
      setError('Please enter House / Flat no.');
      return;
    }
    if (!streetArea) {
      setError('Please enter Street & area.');
      return;
    }
    if (!city) {
      setError('Please enter City.');
      return;
    }
    // Native app requires a Maps link; customer PWA (web) omits in-app / popup map search.
    if (!googleUrl && Platform.OS !== 'web') {
      setError('Please add Google Maps link.');
      return;
    }
    const addressLineParts = [houseNo, streetArea, addAddressLine.trim(), city].filter(Boolean);
    const builtAddressLine = addressLineParts.length > 0 ? addressLineParts.join(', ') : addAddressLine.trim();
    if (!builtAddressLine) {
      setError('Please enter full address.');
      return;
    }
    const pc = addPincode.trim().replace(/\D/g, '').slice(0, 6);
    if (pc.length !== 6) {
      setError('Please enter a valid 6-digit pincode.');
      return;
    }
    const serviceable = serviceability?.serviceable ?? false;
    if (!serviceable) {
      setError('This pincode is not serviceable. Use "Request to serve my area" below.');
      return;
    }
    if (!token) return;
    setLoading(true);
    const goBackAfterSave = returnToBookPickupAddress;
    const editingId = editingAddressId;
    try {
      if (editingId) {
        await updateAddress(token, editingId, {
          label: addAddressLabel.trim() || 'Home',
          addressLine: builtAddressLine,
          pincode: pc,
          isDefault: addIsDefault,
          googleMapUrl: googleUrl || null,
          houseNo,
          streetArea,
          city,
        });
        setEditingAddressId(null);
      } else {
        await createAddress(token, {
          label: addAddressLabel.trim() || 'Home',
          addressLine: builtAddressLine,
          pincode: pc,
          isDefault: addIsDefault,
          googleMapUrl: googleUrl || null,
          houseNo,
          streetArea,
          city,
        });
      }
      setAddAddressLabel('');
      setAddAddressLine('');
      setAddHouseNo('');
      setAddStreetArea('');
      setAddCity('');
      setAddPincode('');
      setAddGoogleUrl('');
      setServiceability(null);
      if (goBackAfterSave) {
        setReturnToBookPickupAddress(false);
        setHomeScreen('bookPickup');
        setBookingStep('address');
        fetchAddresses();
      } else {
        setHomeScreen('addresses');
        fetchAddresses();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : (editingId ? 'Failed to update address' : 'Failed to save address'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = (addressId: string) => {
    if (addressIdsWithActiveOrder.has(addressId) || addressIdsWithActiveSubscription.has(addressId)) {
      Alert.alert(
        'Cannot delete',
        'This address has active orders or an active plan. Complete or cancel orders and wait for the plan to end before deleting.',
        [{ text: 'OK' }]
      );
      return;
    }
    Alert.alert(
      'Delete address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            setError(null);
            setLoading(true);
            try {
              await deleteAddress(token, addressId);
              if (bookingAddressId === addressId) {
                setBookingAddressId(null);
                setBookingAddress(null);
              }
              fetchAddresses();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to delete address');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleBookingAddressSelect = (addr: BackendAddress) => {
    setBookingAddressId(addr.id);
    setBookingAddress(addr);
    setBookingDate('');
    setBookingTimeSlot('');
    setSlotAvailability(null);
    setBookingBranches([]);
    const subId = bookingSubscriptionId;
    if (subId) {
      const sub = meData?.activeSubscriptions?.find((s) => s.id === subId);
      setBookingSelectedBranchId(sub?.branchId ?? null);
      setBookingStep('date');
      return;
    }
    void (async () => {
      setBookingBranchesLoading(true);
      setError(null);
      try {
        const { branches } = await getBranchesForPincode(addr.pincode);
        setBookingBranches(branches);
        if (branches.length === 0) {
          setError('No branch is available for this pincode. Try another address or contact support.');
          return;
        }
        if (branches.length === 1) {
          setBookingSelectedBranchId(branches[0].id);
          setBookingStep('date');
        } else {
          setBookingSelectedBranchId(null);
          setBookingStep('branch');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load branches for this area.');
      } finally {
        setBookingBranchesLoading(false);
      }
    })();
  };

  const handleBookingDateSelect = async (dateStr: string) => {
    const address = bookingAddress ?? (bookingAddressId ? savedAddresses.find((a) => a.id === bookingAddressId) : null);
    if (!address?.pincode) {
      setError('Address not found. Please go back and select an address.');
      return;
    }
    setError(null);
    setBookingDate(dateStr);
    setSlotAvailabilityLoading(true);
    setSlotAvailability(null);
    try {
      const avail = await getSlotAvailability(address.pincode, dateStr, bookingSelectedBranchId);
      if (avail.isHoliday) {
        setSlotAvailability({ isHoliday: true, timeSlots: [], branchName: avail.branchName });
      } else {
        setSlotAvailability({
          isHoliday: false,
          timeSlots: avail.timeSlots,
          branchName: avail.branchName,
        });
      }
      if (!bookingAddress && address) setBookingAddress(address as BackendAddress);
      setBookingStep('time');
    } catch {
      setError('Could not load time slots');
    } finally {
      setSlotAvailabilityLoading(false);
    }
  };

  const loadWebHolidayDates = useCallback(async (monthDate: Date, pincode: string, branchForSlots?: string | null) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const cacheKey = `${pincode}:${branchForSlots ?? ''}:${year}-${month + 1}`;
    const cached = webHolidayCacheRef.current[cacheKey];
    if (cached) {
      setWebHolidayDates((prev) => ({ ...prev, ...cached }));
      return;
    }
    setWebHolidayLoading(true);
    try {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const keys = Array.from({ length: daysInMonth }, (_, i) =>
        toLocalDateKey(new Date(year, month, i + 1))
      );
      const results = await Promise.all(
        keys.map(async (dateKey) => {
          try {
            const avail = await getSlotAvailability(pincode, dateKey, branchForSlots);
            return avail.isHoliday ? dateKey : null;
          } catch {
            return null;
          }
        })
      );
      const monthHolidays: Record<string, true> = {};
      results.forEach((d) => {
        if (d) monthHolidays[d] = true;
      });
      webHolidayCacheRef.current[cacheKey] = monthHolidays;
      setWebHolidayDates((prev) => ({ ...prev, ...monthHolidays }));
    } finally {
      setWebHolidayLoading(false);
    }
  }, []);

  const handleBookingTimeSelect = (timeSlot: string) => {
    setBookingTimeSlot(timeSlot);
    setBookingStep('confirm');
  };

  const handleConfirmBooking = async () => {
    if (!token || !bookingAddressId || !bookingDate || !bookingTimeSlot) return;
    const isSubscriptionBooking = !!bookingSubscriptionId;
    if (!isSubscriptionBooking && selectedServiceIds.length === 0) {
      setError('Please select at least one service.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { orderId } = await createOrder(token, {
        addressId: bookingAddressId,
        pickupDate: bookingDate,
        timeWindow: bookingTimeSlot,
        orderType: isSubscriptionBooking ? 'SUBSCRIPTION' : 'INDIVIDUAL',
        subscriptionId: bookingSubscriptionId ?? undefined,
        selectedServices: selectedServiceIds,
        branchId: isSubscriptionBooking ? undefined : bookingSelectedBranchId ?? undefined,
      });
      setBookingSuccessOrderId(orderId);
      setHomeScreen('bookPickup');
      setBookingStep('services');
      setSelectedServiceIds([]);
      setBookingAddressId(null);
      setBookingAddress(null);
      setBookingDate('');
      setBookingTimeSlot('');
      setSlotAvailability(null);
      setBookingBranches([]);
      setBookingSelectedBranchId(null);
      bookingFromSubscriptionRef.current = false;
      setBookingSubscriptionId(null);
      setBookingSubscriptionValidFrom(null);
      setBookingSubscriptionValidTill(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAreaRequest = async () => {
    setError(null);
    const pc = addPincode.trim().replace(/\D/g, '').slice(0, 6);
    if (pc.length !== 6 || !addAddressLine.trim()) {
      setError('Enter pincode and address first.');
      return;
    }
    setLoading(true);
    try {
      await submitAreaRequest({
        pincode: pc,
        addressLine: addAddressLine.trim(),
        customerName: name || undefined,
        customerPhone: phone.trim() || undefined,
        customerEmail: email || undefined,
      });
      setAreaRequestSent(true);
      setHomeScreen('areaRequestSent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const authFullBleedBackdrop = initializing || step === 'phone' || step === 'otp';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!authFullBleedBackdrop) return;
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const prev = {
      htmlBg: html.style.backgroundColor,
      htmlMinH: html.style.minHeight,
      bodyBg: body.style.backgroundColor,
      bodyMinH: body.style.minHeight,
      rootBg: root?.style.backgroundColor ?? '',
      rootMinH: root?.style.minHeight ?? '',
    };
    html.style.backgroundColor = AUTH_SCREEN_BACKGROUND;
    html.style.minHeight = '100%';
    body.style.backgroundColor = AUTH_SCREEN_BACKGROUND;
    body.style.minHeight = '100dvh';
    if (root) {
      root.style.backgroundColor = AUTH_SCREEN_BACKGROUND;
      root.style.minHeight = '100dvh';
    }
    return () => {
      html.style.backgroundColor = prev.htmlBg;
      html.style.minHeight = prev.htmlMinH;
      body.style.backgroundColor = prev.bodyBg;
      body.style.minHeight = prev.bodyMinH;
      if (root) {
        root.style.backgroundColor = prev.rootBg;
        root.style.minHeight = prev.rootMinH;
      }
    };
  }, [authFullBleedBackdrop]);

  let content: JSX.Element | null = null;

  if (initializing) {
    content = (
      <View style={[styles.centered, styles.authLoadingShell]}>
        <Text style={styles.authLoadingTitle}>Loading…</Text>
      </View>
    );
  } else if (step === 'phone') {
    const logoRaw = welcomeBranding?.logoUrl || welcomeBranding?.appIconUrl;
    const logoUri = logoRaw ? brandingLogoFullUrl(logoRaw) : null;
    content = (
      <View style={styles.phoneAuthRoot}>
        <LinearGradient
          colors={['#7a2d7a', '#5c1a5c', '#3d0f3d']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.phoneAuthBody}>
          <View style={styles.phoneAuthCard}>
            <View style={styles.phoneAuthLogoWrap}>
              {logoUri ? (
                <Image
                  key={logoUri}
                  source={{ uri: logoUri }}
                  style={styles.phoneAuthLogo}
                  resizeMode="contain"
                  accessibilityLabel="Brand logo"
                />
              ) : (
                <View style={styles.phoneAuthLogoFallback}>
                  <Text style={styles.phoneAuthLogoFallbackText}>
                    {welcomeBranding?.businessName?.slice(0, 2)?.toUpperCase() ?? 'We'}
                  </Text>
                </View>
              )}
            </View>

            {error && (
              <>
                <Text style={styles.error}>{error}</Text>
                <TouchableOpacity style={[styles.button, styles.buttonSecondary, { marginTop: 8 }]} onPress={handleRetryConnection} disabled={initializing}>
                  <Text style={styles.buttonSecondaryText}>Retry</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.phoneAuthInputRow}>
              <TextInput
                style={[styles.input, styles.phoneAuthCountryCodeInput]}
                placeholder="+91"
                keyboardType="phone-pad"
                value={countryCode}
                onChangeText={(value) => {
                  const d = value.replace(/\D/g, '').slice(0, 3);
                  setCountryCode(d ? '+' + d : '+91');
                }}
              />
              <TextInput
                style={[styles.input, styles.phoneAuthMobileInput]}
                placeholder="Enter mobile number"
                keyboardType="phone-pad"
                value={mobile}
                onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
                maxLength={10}
              />
            </View>

            {hasLegalContent && (
              <View style={styles.phoneAuthTermsBlock}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setAcceptedTermsAndPrivacy((v) => !v)}
                  style={styles.checkboxRowTouchable}
                >
                  <View style={styles.checkboxRow}>
                    <View style={[styles.termsCheckbox, acceptedTermsAndPrivacy && styles.termsCheckboxChecked]}>
                      {acceptedTermsAndPrivacy ? <MaterialIcons name="check" size={16} color={colors.white} /> : null}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      I accept the{' '}
                      {welcomeBranding?.privacyPolicy?.trim() ? (
                        <Text
                          style={styles.linkText}
                          onPress={() =>
                            setLegalModalContent({
                              title: 'Terms and conditions & Privacy policy',
                              body: welcomeBranding!.privacyPolicy!.trim(),
                            })
                          }
                        >
                          Terms and conditions & Privacy policy
                        </Text>
                      ) : null}
                      .
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, styles.phoneAuthSubmitBtn, (loading || (hasLegalContent && !acceptedTermsAndPrivacy)) && styles.buttonDisabled]}
              onPress={handleRequestOtp}
              disabled={loading || (hasLegalContent && !acceptedTermsAndPrivacy)}
            >
              <Text style={styles.buttonText}>{loading ? 'Sending OTP…' : 'Send OTP'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.phoneAuthCreditRow}>
            <Image source={krackbotLogo} style={styles.creditLogo} resizeMode="contain" accessibilityLabel="Krackbot Studio logo" />
            <Text style={styles.creditNoteOnDark}>Designed & Developed by Krackbot Studio</Text>
          </View>
        </View>

        <Modal visible={!!legalModalContent} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{legalModalContent?.title ?? ''}</Text>
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                <Text style={styles.modalBody}>{legalModalContent?.body ?? ''}</Text>
              </ScrollView>
              <TouchableOpacity style={[styles.button, { marginTop: 12 }]} onPress={() => setLegalModalContent(null)}>
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  } else if (step === 'otp') {
    content = (
      <View style={styles.welcomeScreenOuter}>
        <LinearGradient
          colors={['#7a2d7a', '#5c1a5c', '#3d0f3d']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.welcomeCard}>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>We have sent an OTP to {phone}.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <TextInput
            style={styles.input}
            placeholder="123456"
            keyboardType="number-pad"
            value={otp}
            maxLength={6}
            onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
          />
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.buttonSecondary, loading && styles.buttonDisabled]}
              onPress={() => {
                setOtp('');
                setStep('phone');
              }}
              disabled={loading}
            >
              <Text style={styles.buttonSecondaryText}>Change number</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.rowButton, loading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Verifying…' : 'Verify'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.creditRowOnDark}>
          <Image source={krackbotLogo} style={styles.creditLogo} resizeMode="contain" accessibilityLabel="Krackbot Studio logo" />
          <Text style={styles.creditNoteOnDark}>designed & developed by krackbot studio</Text>
        </View>
      </View>
    );
  } else if (step === 'profile') {
    content = (
      <View style={styles.card}>
        <Text style={styles.title}>Your Profile</Text>
        <Text style={styles.subtitle}>Add your name and email (email optional). Or skip and go to Home.</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <TextInput
          style={styles.input}
          placeholder="Full name"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email (optional)"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSaveProfile}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Saving…' : 'Save profile'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.textButton}
          onPress={handleSkipProfile}
          disabled={loading}
        >
          <Text style={styles.textButtonText}>Skip for now → Go to Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.textButton}
          onPress={handleLogout}
          disabled={loading}
        >
          <Text style={styles.textButtonText}>Log out</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (step === 'done') {
    if (homeScreen === 'addresses') {
      content = (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding]}>
          <View style={styles.card}>
            <Text style={styles.title}>My Addresses</Text>
            <Text style={styles.subtitle}>Add and manage your delivery addresses.</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            {addressesLoading ? (
              <Text style={styles.muted}>Loading…</Text>
            ) : savedAddresses.length === 0 ? (
              <Text style={styles.muted}>No addresses yet. Add one below.</Text>
            ) : (
              savedAddresses.map((a) => {
                const hasActiveOrderOrPlan = addressIdsWithActiveOrder.has(a.id) || addressIdsWithActiveSubscription.has(a.id);
                return (
                  <View key={a.id} style={styles.addressCardRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.addressLabel}>{a.label || 'Address'}</Text>
                        {a.isDefault ? (
                          <View style={styles.defaultAddressTag}>
                            <Text style={styles.defaultAddressTagText}>Default</Text>
                          </View>
                        ) : null}
                        {hasActiveOrderOrPlan ? (
                          <View style={[styles.defaultAddressTag, { backgroundColor: '#f59e0b' }]}>
                            <Text style={styles.defaultAddressTagText}>Active order or plan</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.addressLine}>{a.addressLine}</Text>
                      <Text style={styles.addressPincode}>Pincode: {a.pincode}</Text>
                        {hasActiveOrderOrPlan ? (
                          <Text style={[styles.muted, { marginTop: 4, fontSize: 12 }]}>Edit and delete are disabled until orders and active plans at this address are completed or cancelled.</Text>
                        ) : null}
                    </View>
                    {!hasActiveOrderOrPlan && (
                      <>
                        <TouchableOpacity
                          style={styles.editAddressButton}
                          onPress={() => {
                            setError(null);
                            setEditingAddressId(a.id);
                            setAddAddressLabel(a.label || '');
                            setAddAddressLine(a.addressLine || '');
                            const prefill = prefillAddressFields(a);
                            setAddHouseNo(prefill.houseNo);
                            setAddStreetArea(prefill.streetArea);
                            setAddCity(prefill.city);
                            setAddPincode(a.pincode || '');
                            setAddGoogleUrl(a.googleMapUrl || '');
                            setAddIsDefault(a.isDefault ?? false);
                            setServiceability({ serviceable: true });
                            setReturnToBookPickupAddress(false);
                            setHomeScreen('addAddress');
                          }}
                        >
                          <MaterialIcons name="edit" size={20} color={colors.primary} />
                          <Text style={styles.editAddressButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteAddressButton}
                          onPress={() => handleDeleteAddress(a.id)}
                        >
                          <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                          <Text style={styles.deleteAddressButtonText}>Delete</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                );
              })
            )}
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, { marginTop: 16 }]}
              onPress={() => {
                setError(null);
                setEditingAddressId(null);
                setAddAddressLabel('');
                setAddAddressLine('');
                setAddHouseNo('');
                setAddStreetArea('');
                setAddCity('');
                setAddPincode('');
                setAddGoogleUrl('');
                setServiceability(null);
                setReturnToBookPickupAddress(false);
                setHomeScreen('addAddress');
              }}
            >
              <Text style={styles.buttonSecondaryText}>+ Add address</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.textButton} onPress={() => setHomeScreen('home')}>
              <Text style={styles.textButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    } else if (homeScreen === 'addAddress') {
      const isEditing = !!editingAddressId;
      /** PWA (web): hide in-app / popup “Open Google Maps to search” only; optional paste + “Use link” stays. */
      const hideGoogleMapsSearchRow = Platform.OS === 'web';
      content = (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding]}>
          <View style={styles.card}>
            <Text style={styles.title}>{isEditing ? 'Edit address' : 'Add address'}</Text>
            <Text style={styles.subtitle}>Add address details and check if we serve your area.</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            <TextInput
              style={styles.input}
              placeholder="Label (e.g. Home, Office)"
              value={addAddressLabel}
              onChangeText={setAddAddressLabel}
            />
            {!hideGoogleMapsSearchRow ? (
              <>
                <Text style={[styles.subtitle, { marginTop: 12, marginBottom: 8 }]}>Search location on Google Maps</Text>
                <TouchableOpacity
                  style={styles.googleMapsOpenRow}
                  onPress={() => {
                    setLastGoogleMapsUrl(addGoogleUrl || 'https://www.google.com/maps');
                    if (Platform.OS === 'web') {
                      setShowGoogleMapsPicker(false);
                      const w = (globalThis as { window?: { dispatchEvent?: (event: Event) => boolean; CustomEvent?: new (type: string, init?: Record<string, unknown>) => Event } }).window;
                      if (w?.dispatchEvent && w?.CustomEvent) {
                        w.dispatchEvent(new w.CustomEvent('weyou:pwa-map-popup-open'));
                      } else {
                        setShowGoogleMapsPicker(true);
                      }
                    } else {
                      setShowGoogleMapsPicker(true);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="map" size={24} color={colors.primary} />
                  <Text style={styles.googleMapsOpenText}>Open Google Maps to search</Text>
                  <MaterialIcons name="open-in-new" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                {addGoogleUrl ? (
                  <Text style={[styles.muted, { marginTop: 4 }]} numberOfLines={1}>Link: {addGoogleUrl}</Text>
                ) : null}
              </>
            ) : null}
            <Text style={[styles.subtitle, { marginTop: hideGoogleMapsSearchRow ? 12 : 16, marginBottom: 8 }]}>Address details</Text>
            <TextInput
              style={styles.input}
              placeholder="House / Flat no."
              value={addHouseNo}
              onChangeText={setAddHouseNo}
            />
            <TextInput
              style={styles.input}
              placeholder="Street & area"
              value={addStreetArea}
              onChangeText={setAddStreetArea}
            />
            <TextInput
              style={styles.input}
              placeholder="City"
              value={addCity}
              onChangeText={setAddCity}
            />
            <TextInput
              style={styles.input}
              placeholder="Full address (optional; auto-filled from map)"
              value={addAddressLine}
              onChangeText={setAddAddressLine}
              multiline
            />
            <TextInput
              style={styles.input}
              placeholder="Pincode (6 digits)"
              value={addPincode}
              onChangeText={(t) => setAddPincode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
            {serviceability !== null && (
              <View style={[styles.serviceabilityBox, !serviceability.serviceable && styles.serviceabilityBoxNotServiceable]}>
                {serviceability.serviceable ? (
                  <Text style={styles.serviceableText}>We serve this area. You can save the address.</Text>
                ) : (
                  <>
                    <Text style={styles.notServiceableText}>
                      Sorry, we're not serving your area yet.
                    </Text>
                    <Text style={styles.notServiceableSubtext}>
                      You can request us to add your pincode. We'll notify admin.
                    </Text>
                    <TouchableOpacity
                      style={[styles.button, styles.areaRequestButton, loading && styles.buttonDisabled]}
                      onPress={handleAreaRequest}
                      disabled={loading}
                    >
                      <Text style={styles.buttonText}>Request to serve my area</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="Google Maps link (optional)"
              value={addGoogleUrl}
              onChangeText={setAddGoogleUrl}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setAddIsDefault(!addIsDefault)}
              activeOpacity={0.8}
            >
              <Text style={styles.checkbox}>{addIsDefault ? '☑' : '☐'}</Text>
              <Text style={styles.checkLabel}>Set as default address</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSaveAddress}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Saving…' : isEditing ? 'Update address' : 'Save address'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.textButton}
              onPress={() => {
                setEditingAddressId(null);
                if (returnToBookPickupAddress) {
                  setReturnToBookPickupAddress(false);
                  setHomeScreen('bookPickup');
                  setBookingStep('address');
                } else {
                  setHomeScreen('addresses');
                }
              }}
            >
              <Text style={styles.textButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    } else if (homeScreen === 'areaRequestSent') {
      content = (
        <View style={styles.card}>
          <Text style={styles.title}>Request received</Text>
          <Text style={styles.subtitle}>
            We've sent your pincode and address to our team. We'll get in touch when we start serving your area.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setAreaRequestSent(false);
              setHomeScreen('addresses');
            }}
          >
            <Text style={styles.buttonText}>Back to Addresses</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (homeScreen === 'bookPickup') {
      if (bookingSuccessOrderId) {
        content = (
          <View style={styles.card}>
            <Text style={styles.title}>Booking confirmed</Text>
            <Text style={styles.subtitle}>Your pickup has been scheduled. Order ID: {bookingSuccessOrderId}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setBookingSuccessOrderId(null);
                setHomeScreen('myOrders');
                fetchOrders();
              }}
            >
              <Text style={styles.buttonText}>View in Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.textButton} onPress={() => { setBookingSuccessOrderId(null); setHomeScreen('home'); }}>
              <Text style={styles.textButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        );
      } else if (bookingStep === 'services') {
        content = (
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding]}>
            <View style={styles.card}>
              <Text style={styles.title}>Select services</Text>
              <Text style={styles.subtitle}>Select at least one service. You can choose multiple.</Text>
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={styles.tileGrid}>
                {SERVICE_TYPES.map((s) => {
                  const selected = selectedServiceIds.includes(s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.serviceTile, selected && styles.serviceTileSelected]}
                      onPress={() => toggleService(s.id)}
                      activeOpacity={0.8}
                    >
                      <Image source={SERVICE_ICON_SOURCE[s.id]} style={styles.serviceIconImage} />
                      <Text style={[styles.serviceLabel, selected && styles.serviceLabelSelected]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {selectedServiceIds.length > 0 && (
                <Text style={styles.muted}>Selected: {selectedServiceIds.length} service(s)</Text>
              )}
              <TouchableOpacity
                style={[styles.button, selectedServiceIds.length === 0 && styles.buttonDisabled]}
                onPress={() => {
                  setError(null);
                  if (selectedServiceIds.length === 0) {
                    setError('Please select at least one service.');
                    return;
                  }
                  bookingFromSubscriptionRef.current = false;
                  setBookingSubscriptionId(null);
                  setBookingSubscriptionValidFrom(null);
                  setBookingSubscriptionValidTill(null);
                  setBookingSelectedBranchId(null);
                  setBookingBranches([]);
                  setBookingStep('address');
                }}
                disabled={selectedServiceIds.length === 0}
              >
                <Text style={styles.buttonText}>Continue → Address</Text>
              </TouchableOpacity>

              {(meData?.activeSubscriptions?.length ?? 0) > 0 ? (
                <View style={{ marginTop: 24 }}>
                  <Text style={[styles.subtitle, { fontWeight: '600', marginBottom: 6 }]}>Active plans</Text>
                  <Text style={[styles.muted, { marginBottom: 12 }]}>
                    Tap a plan to book a slot (address is locked for the subscription). You cannot book again with a plan that already has an order in progress.
                  </Text>
                  {(meData?.activeSubscriptions ?? []).map((sub) => {
                    const subAddressId = (sub as ActiveSubscriptionItem).addressId ?? null;
                    const addressLabel = (sub as ActiveSubscriptionItem).addressLabel ?? (subAddressId
                      ? (savedAddresses.find((a) => a.id === subAddressId)?.label || 'Address')
                      : 'Address');
                    const hasActiveOrder = subscriptionIdsWithActiveOrder.has(sub.id);
                    return (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.activePlanTile,
                        { marginBottom: 12 },
                        hasActiveOrder && { opacity: 0.7, backgroundColor: colors.borderLight },
                      ]}
                      onPress={hasActiveOrder ? undefined : () => {
                        setError(null);
                        bookingFromSubscriptionRef.current = true;
                        setBookingSubscriptionId(sub.id);
                        setBookingSelectedBranchId((sub as ActiveSubscriptionItem).branchId ?? null);
                        setBookingSubscriptionValidFrom(sub.validityStartDate?.slice(0, 10) ?? null);
                        setBookingSubscriptionValidTill(sub.validTill?.slice(0, 10) ?? null);
                        setBookingAddressId(subAddressId);
                        setBookingAddress(null);
                        setBookingStep('date');
                      }}
                      activeOpacity={hasActiveOrder ? 1 : 0.8}
                      disabled={hasActiveOrder}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Text style={styles.activePlanTileTitle}>{sub.planName ?? 'Plan'}</Text>
                        <View style={[styles.defaultAddressTag, { backgroundColor: colors.primaryLight }]}>
                          <Text style={styles.defaultAddressTagText}>{addressLabel}</Text>
                        </View>
                      </View>
                      <Text style={styles.activePlanTileSubtext}>
                        {sub.remainingPickups}/{sub.maxPickups} pickups left
                        {sub.validTill ? ` · Valid till ${sub.validTill.slice(0, 10)}` : ''}
                      </Text>
                      {hasActiveOrder && (
                        <Text style={[styles.muted, { marginTop: 6, fontSize: 12 }]}>
                          You have an active order with this plan. Complete or wait for it before booking again.
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                  })}
                </View>
              ) : null}

              <TouchableOpacity style={styles.textButton} onPress={() => { setError(null); setHomeScreen('home'); }}>
                <Text style={styles.textButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
      } else if (bookingStep === 'address') {
        const isSubscriptionBooking = !!bookingSubscriptionId || bookingFromSubscriptionRef.current;
        const subscriptionAddressLocked = isSubscriptionBooking && !!bookingAddressId;
        content = (
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding]}>
            <View style={styles.card}>
              <Text style={styles.title}>{isSubscriptionBooking ? 'Subscription pickup address' : 'Select address'}</Text>
              <Text style={styles.subtitle}>
                {subscriptionAddressLocked
                  ? 'This subscription is tied to the address below. Tap "Next" to choose date & time.'
                  : isSubscriptionBooking
                    ? 'Tap "Next" below to choose date & time.'
                    : 'Choose a saved address for pickup, or add one.'}
              </Text>
              {error && <Text style={styles.error}>{error}</Text>}
              {bookingBranchesLoading ? (
                <Text style={[styles.muted, { marginBottom: 8 }]}>Finding branches for your pincode…</Text>
              ) : null}
              {subscriptionAddressLocked && bookingAddressId && !savedAddresses.find((a) => a.id === bookingAddressId) ? (
                <View style={[styles.addressCard, { marginBottom: 12 }]}>
                  <Text style={styles.muted}>This subscription is tied to an address that is no longer in your list. Pickup and bills will still be for that address. Tap Continue to select date & time.</Text>
                  <TouchableOpacity
                    style={[styles.button, { marginTop: 12 }]}
                    onPress={() => {
                      setError(null);
                      if (bookingSubscriptionId) {
                        const sub = meData?.activeSubscriptions?.find((s) => s.id === bookingSubscriptionId);
                        setBookingSelectedBranchId(sub?.branchId ?? null);
                      }
                      setBookingStep('date');
                    }}
                  >
                    <Text style={styles.buttonText}>Continue → Date</Text>
                  </TouchableOpacity>
                </View>
              ) : savedAddresses.length === 0 ? (
                <Text style={styles.muted}>No addresses yet. Add one below to continue.</Text>
              ) : (
                savedAddresses
                  .filter((a) => !subscriptionAddressLocked || a.id === bookingAddressId)
                  .map((a) => (
                  <View key={a.id} style={styles.addressCardRow}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => {
                        if (subscriptionAddressLocked && a.id === bookingAddressId) {
                          setError(null);
                          if (bookingSubscriptionId) {
                            const sub = meData?.activeSubscriptions?.find((s) => s.id === bookingSubscriptionId);
                            setBookingSelectedBranchId(sub?.branchId ?? null);
                          }
                          setBookingStep('date');
                        } else if (!subscriptionAddressLocked) {
                          handleBookingAddressSelect(a);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.addressLabel}>{a.label || 'Address'}</Text>
                        {a.isDefault ? (
                          <View style={styles.defaultAddressTag}>
                            <Text style={styles.defaultAddressTagText}>Default</Text>
                          </View>
                        ) : null}
                        {subscriptionAddressLocked && a.id === bookingAddressId ? (
                          <View style={styles.defaultAddressTag}>
                            <Text style={styles.defaultAddressTagText}>Subscription address</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.addressLine}>{a.addressLine}</Text>
                      <Text style={styles.addressPincode}>Pincode: {a.pincode}</Text>
                    </TouchableOpacity>
                    {!subscriptionAddressLocked && (
                      <>
                        <TouchableOpacity
                          style={styles.editAddressButton}
                          onPress={() => {
                            setEditingAddressId(a.id);
                            setAddAddressLabel(a.label || '');
                            setAddAddressLine(a.addressLine || '');
                            const prefill = prefillAddressFields(a);
                            setAddHouseNo(prefill.houseNo);
                            setAddStreetArea(prefill.streetArea);
                            setAddCity(prefill.city);
                            setAddPincode(a.pincode || '');
                            setAddGoogleUrl(a.googleMapUrl || '');
                            setAddIsDefault(a.isDefault ?? false);
                            setServiceability({ serviceable: true });
                            setReturnToBookPickupAddress(true);
                            setHomeScreen('addAddress');
                          }}
                        >
                          <MaterialIcons name="edit" size={20} color={colors.primary} />
                          <Text style={styles.editAddressButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteAddressButton}
                          onPress={() => handleDeleteAddress(a.id)}
                        >
                          <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                          <Text style={styles.deleteAddressButtonText}>Delete</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ))
              )}
              {(isSubscriptionBooking || subscriptionAddressLocked) ? (
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary, { marginTop: 16 }]}
                  onPress={() => {
                    setError(null);
                    if (bookingSubscriptionId) {
                      const sub = meData?.activeSubscriptions?.find((s) => s.id === bookingSubscriptionId);
                      setBookingSelectedBranchId(sub?.branchId ?? null);
                    }
                    setBookingStep('date');
                  }}
                >
                  <Text style={styles.buttonText}>Next: Select date & time</Text>
                </TouchableOpacity>
              ) : null}
              {!(isSubscriptionBooking || subscriptionAddressLocked) ? (
                <TouchableOpacity
                  style={[styles.buttonSecondary, { marginTop: savedAddresses.length > 0 ? 12 : 8 }]}
                  onPress={() => {
                    setError(null);
                    setEditingAddressId(null);
                    setAddAddressLabel('');
                    setAddAddressLine('');
                    setAddHouseNo('');
                    setAddStreetArea('');
                    setAddCity('');
                    setAddPincode('');
                    setAddGoogleUrl('');
                    setServiceability(null);
                    setReturnToBookPickupAddress(true);
                    setHomeScreen('addAddress');
                  }}
                >
                  <Text style={styles.buttonSecondaryText}>+ Add address</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.textButton}
                onPress={() => {
                  setError(null);
                  if (bookingSubscriptionId) {
                    bookingFromSubscriptionRef.current = false;
                    setHomeScreen('branches');
                    setBookingSubscriptionId(null);
                    setBookingSubscriptionValidFrom(null);
                    setBookingSubscriptionValidTill(null);
                    setBookingAddressId(null);
                    setBookingAddress(null);
                  } else {
                    setBookingStep('services');
                  }
                }}
              >
                <Text style={styles.textButtonText}>Back</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
      } else if (bookingStep === 'branch') {
        content = (
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding]}>
            <View style={styles.card}>
              <Text style={styles.title}>Select branch</Text>
              <Text style={styles.subtitle}>
                More than one branch serves your address pincode. Choose the branch you want for this pickup.
              </Text>
              {error && <Text style={styles.error}>{error}</Text>}
              {bookingBranches.map((b) => {
                const rawLogoUri = brandingLogoFullUrl(b.logoUrl?.trim() ? b.logoUrl : null);
                const logoUri =
                  rawLogoUri && b.updatedAt
                    ? `${rawLogoUri}${rawLogoUri.includes('?') ? '&' : '?'}v=${encodeURIComponent(b.updatedAt)}`
                    : rawLogoUri;
                const initial = (b.name?.trim()?.[0] ?? '?').toUpperCase();
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.addressCard, styles.branchPickerRow]}
                    onPress={() => {
                      setError(null);
                      setBookingSelectedBranchId(b.id);
                      setBookingStep('date');
                    }}
                    activeOpacity={0.85}
                  >
                    {logoUri ? (
                      <Image source={{ uri: logoUri }} style={styles.branchPickerLogo} resizeMode="contain" />
                    ) : (
                      <View style={styles.branchPickerLogoInitial}>
                        <Text style={styles.branchPickerLogoInitialText}>{initial}</Text>
                      </View>
                    )}
                    <Text style={[styles.addressLabel, styles.branchPickerName]} numberOfLines={2}>
                      {b.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={styles.textButton}
                onPress={() => {
                  setError(null);
                  setBookingStep('address');
                  setBookingBranches([]);
                  setBookingSelectedBranchId(null);
                }}
              >
                <Text style={styles.textButtonText}>Back</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
      } else if (bookingStep === 'date') {
        const today = new Date();
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        let minDate = todayDateOnly;
        let maxDate: Date | undefined;
        if (bookingSubscriptionId && (bookingSubscriptionValidFrom || bookingSubscriptionValidTill)) {
          if (bookingSubscriptionValidFrom) {
            const validFromDate = new Date(bookingSubscriptionValidFrom + 'T12:00:00');
            if (validFromDate > minDate) minDate = validFromDate;
          }
          if (bookingSubscriptionValidTill) {
            maxDate = new Date(bookingSubscriptionValidTill + 'T23:59:59');
          }
        }
        const minDateKey = toLocalDateKey(minDate);
        const maxDateKey = maxDate ? toLocalDateKey(maxDate) : undefined;
        content = (
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding]}>
            <View style={styles.card}>
              <Text style={styles.title}>Select date</Text>
              <Text style={styles.subtitle}>
                {bookingSubscriptionId && (bookingSubscriptionValidFrom || bookingSubscriptionValidTill)
                  ? 'Pick a date within your subscription validity.'
                  : 'Pick a date for pickup (we\'ll show available time slots).'}
              </Text>
              {bookingSubscriptionId && (bookingSubscriptionValidFrom || bookingSubscriptionValidTill) ? (
                <Text style={[styles.muted, { marginTop: 4 }]}>
                  Valid from {bookingSubscriptionValidFrom ? new Date(bookingSubscriptionValidFrom + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}
                  {' to '}
                  {bookingSubscriptionValidTill ? new Date(bookingSubscriptionValidTill + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}
                </Text>
              ) : null}
              {error && <Text style={styles.error}>{error}</Text>}
              <>
                <TouchableOpacity
                  style={[styles.input, styles.datePickerButton]}
                  onPress={() => {
                    const seed = bookingDate ? new Date(bookingDate + 'T12:00:00') : minDate;
                    const monthSeed = new Date(seed.getFullYear(), seed.getMonth(), 1);
                    setWebCalendarMonth(monthSeed);
                    setWebDatePickerVisible(true);
                    const address = bookingAddress ?? (bookingAddressId ? savedAddresses.find((a) => a.id === bookingAddressId) : null);
                    if (address?.pincode) void loadWebHolidayDates(monthSeed, address.pincode, bookingSelectedBranchId);
                  }}
                >
                  <Text style={bookingDate ? styles.datePickerButtonText : styles.datePickerPlaceholder}>
                    {bookingDate || 'Tap to choose date'}
                  </Text>
                </TouchableOpacity>
                <Modal visible={webDatePickerVisible} transparent animationType="fade" onRequestClose={() => setWebDatePickerVisible(false)}>
                  <View style={styles.webCalendarBackdrop}>
                    <View style={styles.webCalendarCard}>
                      <View style={styles.webCalendarHeader}>
                        <TouchableOpacity
                          onPress={() => {
                            const prev = new Date(webCalendarMonth.getFullYear(), webCalendarMonth.getMonth() - 1, 1);
                            const prevLast = new Date(prev.getFullYear(), prev.getMonth() + 1, 0);
                            if (prevLast < minDate) return;
                            setWebCalendarMonth(prev);
                            const address = bookingAddress ?? (bookingAddressId ? savedAddresses.find((a) => a.id === bookingAddressId) : null);
                            if (address?.pincode) void loadWebHolidayDates(prev, address.pincode, bookingSelectedBranchId);
                          }}
                          style={styles.webCalendarNavBtn}
                        >
                          <Text style={styles.webCalendarNavText}>‹</Text>
                        </TouchableOpacity>
                        <Text style={styles.webCalendarTitle}>
                          {webCalendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            const next = new Date(webCalendarMonth.getFullYear(), webCalendarMonth.getMonth() + 1, 1);
                            if (maxDate && next > new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)) return;
                            setWebCalendarMonth(next);
                            const address = bookingAddress ?? (bookingAddressId ? savedAddresses.find((a) => a.id === bookingAddressId) : null);
                            if (address?.pincode) void loadWebHolidayDates(next, address.pincode, bookingSelectedBranchId);
                          }}
                          style={styles.webCalendarNavBtn}
                        >
                          <Text style={styles.webCalendarNavText}>›</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.webCalendarWeekRow}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((wd) => (
                          <Text key={wd} style={styles.webCalendarWeekText}>{wd}</Text>
                        ))}
                      </View>
                      <View style={styles.webCalendarDaysGrid}>
                        {(() => {
                          const y = webCalendarMonth.getFullYear();
                          const m = webCalendarMonth.getMonth();
                          const firstDow = new Date(y, m, 1).getDay();
                          const daysInMonth = new Date(y, m + 1, 0).getDate();
                          const cells: Array<{ key: string; day?: number }> = [];
                          for (let i = 0; i < firstDow; i++) cells.push({ key: `e-${i}` });
                          for (let d = 1; d <= daysInMonth; d++) cells.push({ key: `d-${d}`, day: d });
                          while (cells.length % 7 !== 0) cells.push({ key: `t-${cells.length}` });
                          return cells.map((c) => {
                            if (!c.day) return <View key={c.key} style={styles.webCalendarDayCell} />;
                            const dt = new Date(y, m, c.day);
                            const dateKey = toLocalDateKey(dt);
                            const isOutOfRange = dt < minDate || (maxDate ? dt > maxDate : false);
                            const isHoliday = !!webHolidayDates[dateKey];
                            const isDisabled = isOutOfRange || isHoliday;
                            const isSelected = bookingDate === dateKey;
                            return (
                              <TouchableOpacity
                                key={c.key}
                                style={[
                                  styles.webCalendarDayCell,
                                  isSelected && styles.webCalendarDaySelected,
                                  isDisabled && styles.webCalendarDayDisabled,
                                  isHoliday && styles.webCalendarHolidayDay,
                                ]}
                                disabled={isDisabled}
                                onPress={() => {
                                  setBookingDate(dateKey);
                                  setWebDatePickerVisible(false);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.webCalendarDayText,
                                    isSelected && styles.webCalendarDayTextSelected,
                                    isHoliday && styles.webCalendarHolidayText,
                                  ]}
                                >
                                  {c.day}
                                </Text>
                              </TouchableOpacity>
                            );
                          });
                        })()}
                      </View>
                      {webHolidayLoading ? <Text style={styles.muted}>Loading holidays…</Text> : null}
                      <Text style={[styles.muted, { marginTop: 8 }]}>Red dates are holidays set in Admin and cannot be selected.</Text>
                      <TouchableOpacity style={[styles.button, { marginTop: 12 }]} onPress={() => setWebDatePickerVisible(false)}>
                        <Text style={styles.buttonText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Modal>
              </>
              <TouchableOpacity
                style={[styles.button, bookingDate.length < 10 && styles.buttonDisabled]}
                onPress={() => bookingDate.length >= 10 && handleBookingDateSelect(bookingDate)}
                disabled={bookingDate.length < 10 || slotAvailabilityLoading}
              >
                <Text style={styles.buttonText}>{slotAvailabilityLoading ? 'Checking…' : 'Next: Choose time'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.textButton}
                onPress={() => {
                  setBookingStep(bookingBranches.length > 1 && !bookingSubscriptionId ? 'branch' : 'address');
                  setBookingDate('');
                  setSlotAvailability(null);
                  setWebDatePickerVisible(false);
                  if (!bookingSubscriptionId) {
                    setBookingSelectedBranchId(null);
                    if (bookingBranches.length <= 1) setBookingBranches([]);
                  }
                }}
              >
                <Text style={styles.textButtonText}>Back</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
      } else if (bookingStep === 'time') {
        content = (
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding]}>
            <View style={styles.card}>
              <Text style={styles.title}>Select time slot</Text>
              {slotAvailability?.isHoliday ? (
                <>
                  <Text style={styles.notServiceableText}>We're closed on this date (holiday). Please choose another day.</Text>
                  <TouchableOpacity style={styles.textButton} onPress={() => { setBookingStep('date'); setBookingDate(''); setSlotAvailability(null); }}>
                    <Text style={styles.textButtonText}>Back to date</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.subtitle}>Available slots for {bookingDate}{slotAvailability?.branchName ? ` (${slotAvailability.branchName})` : ''}</Text>
                  {(slotAvailability?.timeSlots ?? []).length === 0 ? (
                    <Text style={styles.muted}>No slots available. Try another date.</Text>
                  ) : (
                    (slotAvailability?.timeSlots ?? []).map((slot) => (
                      <TouchableOpacity
                        key={slot}
                        style={[styles.addressCard, { marginBottom: 8 }]}
                        onPress={() => handleBookingTimeSelect(slot)}
                      >
                        <Text style={styles.addressLabel}>{slot}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                  <TouchableOpacity style={styles.textButton} onPress={() => { setBookingStep('date'); setSlotAvailability(null); }}>
                    <Text style={styles.textButtonText}>Back to date</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        );
      } else if (bookingStep === 'confirm') {
        const isSub = !!bookingSubscriptionId;
        const formattedConfirmDate = (() => {
          if (!bookingDate) return '—';
          const d = new Date(`${bookingDate}T12:00:00`);
          if (Number.isNaN(d.getTime())) return bookingDate;
          const day = String(d.getDate()).padStart(2, '0');
          const month = d.toLocaleDateString('en-IN', { month: 'long' }).toUpperCase();
          const year = d.getFullYear();
          return `${day} ${month} ${year}`;
        })();
        const formattedConfirmTime = (() => {
          const raw = (bookingTimeSlot || '').trim();
          if (!raw) return '—';
          const start = raw.split('-')[0]?.trim() || raw;
          const m = start.match(/^(\d{1,2}):(\d{2})$/);
          if (!m) return start.toUpperCase();
          let hh = Number(m[1]);
          const mm = m[2];
          const ampm = hh >= 12 ? 'PM' : 'AM';
          hh = hh % 12 || 12;
          return `${String(hh).padStart(2, '0')}:${mm} ${ampm}`;
        })();
        const confirmAddressMain = bookingAddress?.label || '—';
        const confirmAddressLine = [bookingAddress?.addressLine, bookingAddress?.pincode].filter(Boolean).join(', ');
        const confirmServicesLabel = isSub
          ? 'Booking with subscription'
          : selectedServiceIds.map((id) => SERVICE_TYPES.find((s) => s.id === id)?.label ?? id).join(', ');
        const confirmBranchLabel =
          slotAvailability?.branchName ??
          (bookingSelectedBranchId ? bookingBranches.find((b) => b.id === bookingSelectedBranchId)?.name : null);
        content = (
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding, styles.confirmScrollContent]} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <Text style={styles.title}>Confirm booking</Text>
              <View style={styles.confirmSummaryCard}>
                <Text style={styles.confirmSummaryLabel}>Address</Text>
                <Text style={styles.confirmSummaryValue}>{confirmAddressMain}</Text>
                <Text style={styles.confirmSummarySubValue}>{confirmAddressLine || '—'}</Text>
                {confirmBranchLabel ? (
                  <View style={[styles.confirmMetaRow, { marginTop: 8 }]}>
                    <Text style={styles.confirmSummaryLabelInline}>Branch</Text>
                    <Text style={styles.confirmSummaryHighlight}>{confirmBranchLabel}</Text>
                  </View>
                ) : null}

                <View style={styles.confirmMetaRow}>
                  <Text style={styles.confirmSummaryLabelInline}>Date</Text>
                  <Text style={styles.confirmSummaryHighlight}>{formattedConfirmDate}</Text>
                </View>
                <View style={styles.confirmMetaRow}>
                  <Text style={styles.confirmSummaryLabelInline}>Time</Text>
                  <Text style={styles.confirmSummaryHighlight}>{formattedConfirmTime}</Text>
                </View>

                <Text style={[styles.confirmSummaryLabel, { marginTop: 8 }]}>Services</Text>
                <Text style={styles.confirmSummaryValue}>{confirmServicesLabel}</Text>
              </View>
              {error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity style={styles.textButton} onPress={() => setBookingStep('time')}>
                <Text style={styles.textButtonText}>Back</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.floatingSubmitWrapper}>
              <TouchableOpacity
                style={[styles.floatingSubmitButton, loading && styles.buttonDisabled]}
                onPress={handleConfirmBooking}
                disabled={loading}
                activeOpacity={0.9}
              >
                <Text style={styles.floatingSubmitText}>{loading ? 'Booking…' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
      } else {
        content = null;
      }
    } else if (homeScreen === 'branches') {
      const selectedBranchesAddress = branchesAddressId ? savedAddresses.find((a) => a.id === branchesAddressId) : null;
      content = (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding]}>
          <View style={styles.plansPageWrapper}>
            <Text style={styles.title}>Branches</Text>
            <Text style={[styles.subtitle, styles.plansSubtitleOneLine]} numberOfLines={2}>
              Select an address to see branches that serve your pincode.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {savedAddresses.length > 0 ? (
              <View style={styles.plansAddressSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                  {savedAddresses.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => { setBranchesAddressId(a.id); }}
                      style={[
                        styles.orderFilterChip,
                        branchesAddressId === a.id && styles.orderFilterChipActive,
                        { marginRight: 0 },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.orderFilterChipText, branchesAddressId === a.id && styles.orderFilterChipTextActive]} numberOfLines={1}>
                        {a.label || 'Address'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.muted, { marginBottom: 8 }]}>
                  You don't have any addresses yet. Add one to see which branches serve your area.
                </Text>
                <TouchableOpacity
                  style={[styles.buttonSecondary, { marginRight: 0 }]}
                  onPress={() => {
                    setError(null);
                    setHomeScreen('addresses');
                    fetchAddresses();
                  }}
                >
                  <Text style={styles.buttonSecondaryText}>+ Add address</Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedBranchesAddress?.pincode ? (
              <Text style={[styles.muted, { marginBottom: 12 }]}>Pincode: {selectedBranchesAddress.pincode}</Text>
            ) : null}

            {savedAddresses.length === 0 ? (
              <Text style={[styles.muted, { marginBottom: 16 }]}>Add an address in Profile → My addresses to see branches for your area.</Text>
            ) : branchesListLoading ? (
              <Text style={[styles.muted, { marginBottom: 16 }]}>Loading branches…</Text>
            ) : branchesForPincode.length === 0 ? (
              <Text style={[styles.muted, { marginBottom: 16 }]}>No branches listed for this pincode.</Text>
            ) : (
              branchesForPincode.map((b) => {
                const rawLogoUri = brandingLogoFullUrl(b.logoUrl?.trim() ? b.logoUrl : null);
                const logoUri =
                  rawLogoUri && b.updatedAt
                    ? `${rawLogoUri}${rawLogoUri.includes('?') ? '&' : '?'}v=${encodeURIComponent(b.updatedAt)}`
                    : rawLogoUri;
                const initial = (b.name?.trim()?.[0] ?? '?').toUpperCase();
                return (
                  <View key={b.id} style={[styles.addressCard, styles.branchPickerRow, { marginBottom: 10 }]}>
                    {logoUri ? (
                      <Image source={{ uri: logoUri }} style={styles.branchPickerLogo} resizeMode="contain" />
                    ) : (
                      <View style={styles.branchPickerLogoInitial}>
                        <Text style={styles.branchPickerLogoInitialText}>{initial}</Text>
                      </View>
                    )}
                    <Text style={[styles.addressLabel, styles.branchPickerName]} numberOfLines={2}>
                      {b.name}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      );
    } else if (homeScreen === 'subscriptionDetail') {
      content = (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding]}>
          <View style={styles.card}>
            <TouchableOpacity style={styles.textButton} onPress={() => { setHomeScreen('branches'); setSelectedSubscriptionId(null); setSubscriptionDetail(null); }}>
              <Text style={styles.textButtonText}>← Back to Branches</Text>
            </TouchableOpacity>
            {subscriptionDetailLoading ? (
              <Text style={styles.muted}>Loading…</Text>
            ) : subscriptionDetail ? (
              <>
                <Text style={styles.title}>{subscriptionDetail.planName ?? 'Plan'}</Text>
                <View style={[styles.defaultAddressTag, { alignSelf: 'flex-start', marginVertical: 8, backgroundColor: subscriptionDetail.active ? colors.primary : '#6b7280' }]}>
                  <Text style={styles.defaultAddressTagText}>{subscriptionDetail.active ? 'Active' : 'Inactive'}</Text>
                </View>
                <Text style={styles.subtitle}>
                  {subscriptionDetail.remainingPickups}/{subscriptionDetail.maxPickups} pickups left
                  {subscriptionDetail.remainingKg != null ? ` · ${subscriptionDetail.remainingKg} kg left` : ''}
                  {subscriptionDetail.remainingItems != null ? ` · ${subscriptionDetail.remainingItems} items left` : ''}
                </Text>
                <Text style={styles.muted}>Valid till {subscriptionDetail.validTill.slice(0, 10)}</Text>
                <View style={{ marginTop: 16, marginBottom: 8 }}>
                  <Text style={[styles.subtitle, { fontWeight: '600' }]}>Payment</Text>
                  <Text style={subscriptionDetail.paymentStatus === 'PAID' ? styles.orderAmountPaid : styles.muted}>
                    {subscriptionDetail.paymentStatus === 'PAID' ? 'Paid' : 'Not paid'}
                  </Text>
                  <Text style={[styles.muted, { fontSize: 12, marginTop: 4 }]}>
                    {subscriptionDetail.paymentStatus === 'PAID' ? 'Admin has confirmed payment for this subscription.' : 'Payment will show as Paid once admin confirms it.'}
                  </Text>
                </View>
                {subscriptionDetail.invoice ? (
                  <>
                    {subscriptionInvoiceError ? (
                      <Text style={[styles.error, { marginTop: 8 }]}>{subscriptionInvoiceError}</Text>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.button, { marginTop: 8 }]}
                      onPress={async () => {
                        if (!token) return;
                        try {
                          setSubscriptionInvoiceError(null);
                          setSubscriptionInvoiceLoading(true);
                          const base64 = await fetchInvoicePdfBase64(subscriptionDetail.invoice!.id, token);
                          const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
                          const fileUri = `${dir}subscription-invoice-${subscriptionDetail.invoice!.id}-${Date.now()}.pdf`;
                          await FileSystem.writeAsStringAsync(fileUri, base64, {
                            encoding: FileSystem.EncodingType.Base64,
                          });
                          setSubscriptionInvoicePreviewUri(fileUri);
                        } catch (e) {
                          setSubscriptionInvoiceError((e as Error).message);
                        } finally {
                          setSubscriptionInvoiceLoading(false);
                        }
                      }}
                      disabled={subscriptionInvoiceLoading}
                    >
                      {subscriptionInvoiceLoading ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.buttonText}>Preview invoice</Text>
                      )}
                    </TouchableOpacity>
                    {subscriptionInvoicePreviewUri ? (
                      <View style={{ marginTop: 16 }}>
                        <Text style={[styles.subtitle, { fontWeight: '600', marginBottom: 8 }]}>Invoice preview</Text>
                        <View style={styles.invoicePreviewContainer}>
                          <WebView
                            source={{ uri: subscriptionInvoicePreviewUri }}
                            style={styles.invoicePreviewWebView}
                          />
                        </View>
                        <View style={styles.invoiceActions}>
                          <TouchableOpacity
                            style={[styles.invoiceCta, styles.invoiceCtaDownload]}
                            onPress={() => Linking.openURL(subscriptionInvoicePreviewUri)}
                          >
                            <Text style={styles.invoiceCtaText}>Download</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.invoiceCta, styles.invoiceCtaDownload]}
                            onPress={async () => {
                              try {
                                const PrintModule = await import('expo-print').catch(() => null);
                                const Print = PrintModule && (PrintModule.default ?? PrintModule);
                                if (Print?.printAsync) await Print.printAsync({ uri: subscriptionInvoicePreviewUri });
                                else setSubscriptionInvoiceError('Print is not available.');
                              } catch (e) {
                                setSubscriptionInvoiceError((e as Error).message);
                              }
                            }}
                          >
                            <Text style={styles.invoiceCtaText}>Print</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.invoiceCta, styles.invoiceCtaShare]}
                            onPress={async () => {
                              try {
                                const available = await Sharing.isAvailableAsync();
                                if (available) {
                                  await Sharing.shareAsync(subscriptionInvoicePreviewUri, {
                                    mimeType: 'application/pdf',
                                    dialogTitle: 'Share subscription invoice',
                                  });
                                } else {
                                  setSubscriptionInvoiceError('Sharing is not available on this device.');
                                }
                              } catch (e) {
                                setSubscriptionInvoiceError((e as Error).message);
                              }
                            }}
                          >
                            <Text style={[styles.invoiceCtaText, { color: colors.white }]}>Share</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.muted}>Invoice not available.</Text>
                )}
              </>
            ) : (
              <Text style={styles.muted}>Could not load plan details.</Text>
            )}
          </View>
        </ScrollView>
      );
    } else if (homeScreen === 'myOrders') {
      const ongoing = orders.filter((o) => {
        const s = (o.status || '').toUpperCase();
        return s !== 'DELIVERED' && s !== 'CANCELLED';
      });
      const completed = orders.filter((o) => {
        const s = (o.status || '').toUpperCase();
        return s === 'DELIVERED' || s === 'CANCELLED';
      });
      const sortedOrders = [...ongoing, ...completed];
      function utilisationSummary(o: OrderSummary): string {
        const typ = (o as OrderSummary & { orderType?: string }).orderType;
        if (typ === 'SUBSCRIPTION' && (o.subscriptionUsageKg != null || o.subscriptionUsageItems != null)) {
          const kg = o.subscriptionUsageKg != null ? `${o.subscriptionUsageKg} kg` : '';
          const items = o.subscriptionUsageItems != null ? `${o.subscriptionUsageItems} items` : '';
          return [kg, items].filter(Boolean).join(' · ') || 'Subscription';
        }
        return (o.serviceType || '').split(',').map((s) => serviceTypeDisplayLabel(s.trim())).filter(Boolean).join(', ') || '—';
      }
      content = (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding]}>
          <View style={styles.contentPageWrapper}>
            <Text style={styles.title}>Orders</Text>
            <Text style={styles.subtitle}>All orders (ongoing and completed) with status and utilisation.</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            {ordersLoading ? (
              <Text style={styles.muted}>Loading…</Text>
            ) : sortedOrders.length === 0 ? (
              <Text style={styles.muted}>No orders yet.</Text>
            ) : (
              sortedOrders.map((o) => {
                const src = (o as OrderSummary & { orderSource?: string | null }).orderSource;
                const typ = (o as OrderSummary & { orderType?: string }).orderType;
                const typeLabel = src === 'WALK_IN' ? 'Walk-in' : typ === 'SUBSCRIPTION' ? 'Subscription' : 'Online';
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.addressCard, styles.orderTileCard, { marginBottom: 8 }]}
                    onPress={() => {
                      setSelectedOrderId(o.id);
                      setOrderDetail(null);
                      setOrderInvoices([]);
                      setHomeScreen('orderDetail');
                    }}
                  >
                    <View style={styles.orderTileHeader}>
                      <Text style={[styles.addressLabel, styles.orderTileOrderId]}>#{o.id}</Text>
                      <View style={styles.orderTileTag}>
                        <Text style={styles.orderTileTagText}>{typeLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.addressLine}>{String(o.pickupDate).slice(0, 10)} {o.timeWindow}</Text>
                    <Text style={[styles.addressLine, { marginTop: 2, fontSize: 13 }]}>
                      Utilisation: {utilisationSummary(o)}
                    </Text>
                    {o.paymentStatus === 'CAPTURED' ? (
                      <View style={styles.orderAmountPaidRow}>
                        <View style={styles.paidTickCircle}>
                          <MaterialIcons name="check" size={14} color={colors.white} />
                        </View>
                        <Text style={styles.orderAmountPaid}>
                          Paid{o.amountToPayPaise != null && o.amountToPayPaise > 0 ? `: ₹${(o.amountToPayPaise / 100).toFixed(2)}` : ''}
                        </Text>
                      </View>
                    ) : o.paymentStatus === 'FAILED' ? (
                      <Text style={styles.error}>Payment failed</Text>
                    ) : o.amountToPayPaise != null && o.amountToPayPaise > 0 ? (
                      <Text style={styles.orderAmount}>Amount to pay: ₹{(o.amountToPayPaise / 100).toFixed(2)}</Text>
                    ) : null}
                    <View style={styles.orderTileStatusRow}>
                      <Text style={[styles.orderTileStatusText, o.status === 'CANCELLED' && styles.orderTileStatusCancelled]}>
                        {orderStatusLabel(o.status)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      );
    } else if (homeScreen === 'orderDetail' && selectedOrderId) {
      content = (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding]}>
          <View style={styles.card}>
            <Text style={styles.title}>Order #{selectedOrderId}</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            {orderDetail ? (
              <>
                {(() => {
                  const isWalkInOrder =
                    String(orderDetail.orderSource ?? '').toUpperCase() === 'WALK_IN'
                    || String(orderDetail.orderType ?? '').toUpperCase() === 'WALK_IN';
                  const d = new Date(`${String(orderDetail.pickupDate).slice(0, 10)}T12:00:00`);
                  const formattedDate = Number.isNaN(d.getTime())
                    ? String(orderDetail.pickupDate).slice(0, 10)
                    : `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-IN', { month: 'long' }).toUpperCase()} ${d.getFullYear()}`;
                  const rawSlot = (orderDetail.timeWindow || '').trim();
                  const slotStart = rawSlot.split('-')[0]?.trim() || rawSlot;
                  const m = slotStart.match(/^(\d{1,2}):(\d{2})$/);
                  const formattedTime = isWalkInOrder
                    ? 'Walk in'
                    : m
                    ? `${String((Number(m[1]) % 12) || 12).padStart(2, '0')}:${m[2]} ${Number(m[1]) >= 12 ? 'PM' : 'AM'}`
                    : slotStart.toUpperCase();
                  const serviceLabel = (orderDetail.serviceTypes ?? (orderDetail.serviceType ? [orderDetail.serviceType] : []))
                    .map(serviceTypeDisplayLabel)
                    .join(', ');
                  const addr = orderDetail.addressId ? addresses.find((a) => a.id === orderDetail.addressId) : null;
                  const addressMain = isWalkInOrder ? 'Walk in Address' : (addr?.label ?? orderDetail.addressLabel ?? 'Address');
                  const addressLine = isWalkInOrder ? 'Walk in' : (addr?.addressLine ?? orderDetail.addressLine ?? '');
                  const pincode = isWalkInOrder ? '' : (addr?.pincode ?? orderDetail.pincode ?? '');
                  return (
                    <View style={styles.confirmSummaryCard}>
                      <View style={styles.confirmMetaRow}>
                        <Text style={styles.confirmSummaryLabelInline}>Status</Text>
                        <View style={styles.statusChip}>
                          <Text style={styles.statusChipText}>{orderStatusLabel(orderDetail.status)}</Text>
                        </View>
                      </View>
                      <Text style={styles.confirmSummaryLabel}>Address</Text>
                      <Text style={styles.confirmSummaryValue}>{addressMain}</Text>
                      <Text style={styles.confirmSummarySubValue}>
                        {[addressLine, pincode].filter(Boolean).join(', ') || '—'}
                      </Text>
                      <View style={styles.confirmMetaRow}>
                        <Text style={styles.confirmSummaryLabelInline}>Date</Text>
                        <Text style={styles.confirmSummaryHighlight}>{formattedDate}</Text>
                      </View>
                      <View style={styles.confirmMetaRow}>
                        <Text style={styles.confirmSummaryLabelInline}>Time</Text>
                        <Text style={styles.confirmSummaryHighlight}>{formattedTime}</Text>
                      </View>
                      <Text style={[styles.confirmSummaryLabel, { marginTop: 8 }]}>Services</Text>
                      <Text style={styles.confirmSummaryValue}>{serviceLabel || '—'}</Text>
                    </View>
                  );
                })()}
                {(() => {
                  const finalInv = orderInvoices.find((i) => i.type === 'FINAL');
                  const isPaid = orderDetail.paymentStatus === 'CAPTURED';
                  if (finalInv) {
                    if (isPaid) {
                      return (
                        <LinearGradient
                          colors={[colors.primary, colors.primaryDark]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.amountPaidBoxGradient}
                        >
                          <View style={styles.orderAmountPaidRow}>
                            <View style={styles.paidTickCircleOnGreen}>
                              <MaterialIcons name="check" size={14} color={colors.white} />
                            </View>
                            <Text style={styles.amountPaidLabelOnGradient}>Amount paid</Text>
                          </View>
                          <Text style={styles.amountPaidValueOnGradient}>₹{(finalInv.total / 100).toFixed(2)}</Text>
                          <Text style={styles.amountPaidMutedOnGradient}>Payment recorded</Text>
                        </LinearGradient>
                      );
                    }
                    return (
                      <View style={styles.amountToPayBox}>
                        <Text style={styles.amountToPayLabel}>Amount to pay</Text>
                        <Text style={styles.amountToPayValue}>₹{(finalInv.total / 100).toFixed(2)}</Text>
                        <Text style={styles.muted}>Final invoice (includes any discount)</Text>
                      </View>
                    );
                  }
                  if (isPaid) {
                    return (
                      <LinearGradient
                        colors={[colors.primary, colors.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.amountPaidBoxGradient}
                      >
                        <View style={styles.orderAmountPaidRow}>
                          <View style={styles.paidTickCircleOnGreen}>
                            <MaterialIcons name="check" size={14} color={colors.white} />
                          </View>
                          <Text style={styles.amountPaidLabelOnGradient}>Payment status</Text>
                        </View>
                        <Text style={styles.amountPaidValueOnGradient}>Paid</Text>
                      </LinearGradient>
                    );
                  }
                  return null;
                })()}
                <Text style={[styles.subtitle, { marginTop: 12 }]}>Invoices</Text>
                {invoiceError ? (
                  <Text style={[styles.error, { marginBottom: 8 }]}>{invoiceError}</Text>
                ) : null}
                {(() => {
                  const hasFinal = orderInvoices.some((i) => i.type === 'FINAL');
                  const invoicesToShow = hasFinal
                    ? orderInvoices.filter((i) => i.type === 'FINAL')
                    : orderInvoices;
                  return invoicesToShow.length === 0 ? (
                    <Text style={styles.muted}>No invoices yet.</Text>
                  ) : (
                    invoicesToShow.map((inv) => {
                    const items = inv.items ?? [];
                    const discountPaise = inv.discountPaise ?? 0;
                    const subtotal = inv.subtotal ?? inv.total;
                    const tax = inv.tax ?? 0;
                    const issuedLabel = inv.issuedAt
                      ? new Date(inv.issuedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : null;
                    return (
                      <View key={inv.id} style={[styles.addressCard, styles.invoiceRow]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                          <View style={{ flexShrink: 1, paddingRight: 8 }}>
                            <Text style={styles.invoiceTypeLabel}>
                              {inv.type === 'ACKNOWLEDGEMENT' ? 'Acknowledgement invoice' : inv.type === 'FINAL' ? 'Final invoice' : inv.type}
                            </Text>
                            {inv.code ? (
                              <Text style={[styles.muted, { marginTop: 2 }]}>
                                Invoice no: {inv.code}
                              </Text>
                            ) : null}
                          </View>
                          {issuedLabel ? (
                            <Text style={[styles.muted, { textAlign: 'right', fontSize: 12 }]}>
                              Issued: {issuedLabel}
                            </Text>
                          ) : null}
                        </View>
                        {items.length > 0 ? (
                          <>
                            {items.map((item) => {
                              const iconUri = item.icon && (item.icon.startsWith('http') || item.icon.startsWith('/'))
                                ? brandingLogoFullUrl(item.icon)
                                : null;
                              const metaParts = [
                                item.segmentLabel?.trim() || null,
                                item.serviceLabel?.trim() || null,
                              ].filter(Boolean) as string[];
                              const meta = metaParts.length ? metaParts.join(' · ') : null;
                              return (
                                <View key={item.id} style={styles.invoiceItemRow}>
                                  {iconUri ? (
                                    <Image source={{ uri: iconUri }} style={styles.invoiceItemIcon} />
                                  ) : null}
                                  <View style={{ flex: 1 }}>
                                    <Text
                                      style={[styles.invoiceItemName, !iconUri && styles.invoiceItemNameNoIcon]}
                                      numberOfLines={2}
                                    >
                                      {item.name}
                                      {item.quantity !== 1 ? ` × ${item.quantity}` : ''}
                                    </Text>
                                    {meta ? (
                                      <Text style={styles.muted} numberOfLines={1}>
                                        {meta}
                                      </Text>
                                    ) : null}
                                  </View>
                                  <Text style={styles.invoiceItemAmount}>₹{(item.amount / 100).toFixed(2)}</Text>
                                </View>
                              );
                            })}
                            <View style={styles.invoiceTotals}>
                              <View style={styles.invoiceTotalRow}>
                                <Text style={styles.invoiceTotalLabel}>Subtotal</Text>
                                <Text style={styles.invoiceTotalValue}>₹{(subtotal / 100).toFixed(2)}</Text>
                              </View>
                              {tax > 0 && (
                                <View style={styles.invoiceTotalRow}>
                                  <Text style={styles.invoiceTotalLabel}>Tax</Text>
                                  <Text style={styles.invoiceTotalValue}>₹{(tax / 100).toFixed(2)}</Text>
                                </View>
                              )}
                              {discountPaise > 0 && (
                                <View style={styles.invoiceTotalRow}>
                                  <Text style={styles.invoiceTotalLabel}>Discount</Text>
                                  <Text style={[styles.invoiceTotalValue, { color: colors.success }]}>- ₹{(discountPaise / 100).toFixed(2)}</Text>
                                </View>
                              )}
                              <View style={[styles.invoiceTotalRow, styles.invoiceTotalRowFinal]}>
                                <Text style={styles.invoiceTotalLabelFinal}>Total</Text>
                                <Text style={styles.invoiceTotalValueFinal}>₹{(inv.total / 100).toFixed(2)}</Text>
                              </View>
                            </View>
                          </>
                        ) : (
                          <Text style={styles.muted}>Total: ₹{(inv.total / 100).toFixed(2)}</Text>
                        )}
                      </View>
                    );
                  })
                );
                }
                )()}
              </>
            ) : (
              <Text style={styles.muted}>Loading…</Text>
            )}
            <TouchableOpacity style={styles.textButton} onPress={() => { setHomeScreen('myOrders'); setSelectedOrderId(null); setOrderDetail(null); setInvoiceError(null); fetchOrders(); }}>
              <Text style={styles.textButtonText}>Back to Orders</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    } else if (homeScreen === 'profile') {
      content = (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.scrollContentNoTopPadding]}>
          <View style={styles.contentPageWrapper}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Edit your details. Mobile number cannot be changed.</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              value={name}
              onChangeText={setName}
            />
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Email (optional)"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.inputLabel}>Mobile number (cannot be changed)</Text>
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={userPhone || '—'}
              editable={false}
              placeholder="—"
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={async () => {
                setError(null);
                setLoading(true);
                try {
                  if (token) await updateMe(token, { name: name.trim() || undefined, email: email.trim() || undefined });
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to save');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonSecondary, { marginTop: 12 }]}
              onPress={() => { setError(null); setHomeScreen('addresses'); fetchAddresses(); }}
            >
              <Text style={styles.buttonSecondaryText}>Edit my addresses</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.buttonSecondary, styles.profileLogoutButton, loading && styles.buttonDisabled]}
              onPress={handleLogout}
              disabled={loading}
            >
              <Text style={styles.profileLogoutText}>Log out</Text>
            </TouchableOpacity>

            <Text style={[styles.inputLabel, { marginTop: 24, marginBottom: 8 }]}>Account settings</Text>
            <View style={styles.profileAccountSettingsRow}>
              <TouchableOpacity
                style={styles.profileAccountSettingItem}
                onPress={() => {
                  if (welcomeBranding?.termsAndConditions?.trim()) {
                    setLegalModalContent({ title: 'Terms and Conditions', body: welcomeBranding.termsAndConditions.trim() });
                  }
                }}
                disabled={!welcomeBranding?.termsAndConditions?.trim()}
              >
                <MaterialIcons name="description" size={20} color={colors.primary} />
                <Text style={[styles.profileAccountSettingText, !welcomeBranding?.termsAndConditions?.trim() && styles.muted]}>Terms and conditions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileAccountSettingItem}
                onPress={() => {
                  if (welcomeBranding?.privacyPolicy?.trim()) {
                    setLegalModalContent({ title: 'Privacy Policy', body: welcomeBranding.privacyPolicy.trim() });
                  }
                }}
                disabled={!welcomeBranding?.privacyPolicy?.trim()}
              >
                <MaterialIcons name="policy" size={20} color={colors.primary} />
                <Text style={[styles.profileAccountSettingText, !welcomeBranding?.privacyPolicy?.trim() && styles.muted]}>Privacy policy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileAccountSettingItem}
                onPress={() => setDeleteAccountModalVisible(true)}
              >
                <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                <Text style={[styles.profileAccountSettingText, { color: colors.error }]}>Delete account</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Modal visible={deleteAccountModalVisible} animationType="fade" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Delete account</Text>
                <Text style={styles.modalBody}>
                  To delete your account and associated data, please contact support. Your data will be removed as per our privacy policy.
                </Text>
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary, { marginTop: 16 }]}
                  onPress={() => setDeleteAccountModalVisible(false)}
                >
                  <Text style={styles.buttonText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      );
    } else {
      const winWidth = appScreenWidth;
      // Full width; height is adjustable (ratio of width, e.g. 0.5 = half, 9/16 ≈ 0.56 for banner)
      const carouselHeightRatio = 9 / 16;
      const carouselHeight = Math.round(winWidth * carouselHeightRatio);
      const bannerImages = [
        require('./assets/banners/banner1.png'),
        require('./assets/banners/banner2.png'),
        require('./assets/banners/banner3.png'),
      ];
      const showApiCarousel = carouselImageUrls.length > 0;
      content = (
        <View style={styles.homeLayout}>
          <ScrollView
            style={[styles.scroll, styles.homeMainScroll]}
            contentContainerStyle={[styles.scrollContentNoTopPadding, styles.homeScrollContent]}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            refreshControl={
              <RefreshControl refreshing={homeRefreshing} onRefresh={onHomeRefresh} colors={[colors.primary]} tintColor={colors.primary} />
            }
          >
            <View style={styles.carouselWrapper}>
              <ScrollView
                ref={carouselScrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={winWidth}
                snapToAlignment="start"
                contentContainerStyle={styles.carouselContent}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / winWidth);
                  carouselPageRef.current = idx;
                }}
              >
                {showApiCarousel
                  ? carouselImageUrls.map((url, index) => (
                      <View key={index} style={[styles.carouselSlide, { width: winWidth, height: carouselHeight }]}>
                        <Image source={{ uri: carouselImageFullUrl(url) }} style={styles.carouselImage} resizeMode="cover" />
                      </View>
                    ))
                  : bannerImages.map((src, index) => (
                      <View key={index} style={[styles.carouselSlide, { width: winWidth, height: carouselHeight }]}>
                        <Image source={src} style={styles.carouselImage} resizeMode="cover" />
                      </View>
                    ))}
              </ScrollView>
            </View>
            <View style={[styles.card, styles.homeWelcomeCard]}>
              <Text style={styles.title}>Welcome{ name ? `, ${name}` : ''}</Text>
              <Text style={styles.subtitle}>Use the menu below to book a pickup, see branches for your area, view orders, or manage your profile.</Text>
              {error && <Text style={styles.error}>{error}</Text>}
            </View>
            {token && (() => {
              const activeOrders = orders.filter((o) => {
                const s = (o.status || '').toUpperCase();
                return s !== 'DELIVERED' && s !== 'CANCELLED';
              });
              if (activeOrders.length > 0) {
                return (
                  <View style={styles.activeOrdersSection}>
                    <Text style={styles.activeOrdersTitle}>Active Orders</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.activeOrdersScroll}
                    >
                      {activeOrders.map((o) => {
                        const src = (o as OrderSummary & { orderSource?: string | null }).orderSource;
                        const typ = (o as OrderSummary & { orderType?: string }).orderType;
                        const typeLabel = src === 'WALK_IN' ? 'Walk-in' : typ === 'SUBSCRIPTION' ? 'Subscription' : 'Online';
                        const isPaid = o.paymentStatus === 'CAPTURED';
                        return (
                          <TouchableOpacity
                            key={o.id}
                            style={styles.activeOrderCard}
                            onPress={() => {
                              setSelectedOrderId(o.id);
                              setOrderDetail(null);
                              setOrderInvoices([]);
                              setHomeScreen('orderDetail');
                            }}
                          >
                            <View style={styles.activeOrderCardLeft}>
                              <View style={styles.activeOrderCardTop}>
                                <Text style={styles.activeOrderId} numberOfLines={1}>#{o.id}</Text>
                                <View style={styles.activeOrderTag}>
                                  <Text style={styles.activeOrderTagText}>{typeLabel}</Text>
                                </View>
                                <Text style={styles.activeOrderServiceLine} numberOfLines={1}>
                                  {(o.serviceType || '').split(',').map((s) => serviceTypeDisplayLabel(s.trim())).filter(Boolean).join(', ')}
                                </Text>
                                <Text style={styles.activeOrderDateLine}>{String(o.pickupDate).slice(0, 10)}</Text>
                              </View>
                              <View style={styles.activeOrderCardPayment}>
                                {isPaid ? (
                                  <View style={styles.activeOrderPaidRow}>
                                    <View style={styles.activeOrderPaidTickCircle}>
                                      <MaterialIcons name="check" size={10} color={colors.white} />
                                    </View>
                                    <Text style={styles.activeOrderPaidText}>Paid{o.amountToPayPaise != null && o.amountToPayPaise > 0 ? ` ₹${(o.amountToPayPaise / 100).toFixed(2)}` : ''}</Text>
                                  </View>
                                ) : o.paymentStatus === 'FAILED' ? (
                                  <Text style={styles.activeOrderPaymentFailed}>Payment failed</Text>
                                ) : o.amountToPayPaise != null && o.amountToPayPaise > 0 ? (
                                  <Text style={styles.activeOrderToPay}>To pay: ₹{(o.amountToPayPaise / 100).toFixed(2)}</Text>
                                ) : null}
                              </View>
                              <View style={styles.activeOrderCardStatus}>
                                <Text style={[styles.activeOrderStatus, o.status === 'CANCELLED' && styles.orderTileStatusCancelled]}>{orderStatusLabel(o.status)}</Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                );
              }
              return (
                <View style={styles.noActiveOrdersWrapper}>
                  <Text style={styles.noActiveOrdersText}>No active orders</Text>
                </View>
              );
            })()}
          </ScrollView>
        </View>
      );
    }
  }

  const showBottomNav = step === 'done';

  return (
    <SafeAreaProvider>
      <View
        style={{
          flex: 1,
          backgroundColor: authFullBleedBackdrop ? AUTH_SCREEN_BACKGROUND : colors.elevation1,
        }}
      >
        <SafeAreaView
          style={[styles.safeArea, authFullBleedBackdrop && styles.safeAreaTransparent]}
          edges={showBottomNav ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}
        >
        <StatusBar style={authFullBleedBackdrop ? 'light' : 'dark'} />
        <KeyboardAvoidingView
          style={[
            styles.container,
            showBottomNav && styles.containerWithNav,
            authFullBleedBackdrop && styles.containerAuthBleed,
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {showBottomNav ? (
            <View style={[styles.mainWithNav, isDesktopWeb && styles.mainWithNavDesktop, isDesktopWeb && { width: desktopMobileFrameWidth }]}>
              <View style={styles.topNavBar}>
                <View style={styles.topNavLogo}>
                  {welcomeBranding?.logoUrl ? (
                    <Image
                      key={welcomeBranding.logoUrl}
                      source={{ uri: brandingLogoFullUrl(welcomeBranding.logoUrl) ?? '' }}
                      style={styles.topNavLogoImage}
                      resizeMode="contain"
                      accessibilityLabel="Logo"
                    />
                  ) : (
                    <Text style={styles.topNavLogoText} numberOfLines={1}>
                      {welcomeBranding?.businessName?.slice(0, 2)?.toUpperCase() ?? 'We'}
                    </Text>
                  )}
                </View>
                <View style={styles.topNavActions}>
                  <TouchableOpacity
                    style={styles.topNavPriceListButton}
                    onPress={() => {
                      void openPriceListModal();
                    }}
                    accessibilityLabel="Price list"
                  >
                    <Text style={styles.topNavPriceListButtonText}>Price list</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.topNavBell}
                    onPress={() => {
                      if (token) fetchOrders();
                      setNotificationsModalVisible(true);
                    }}
                    accessibilityLabel="Notifications"
                  >
                    <MaterialIcons name="notifications-none" size={26} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.contentArea}>{content}</View>
              <View style={styles.bottomNavWrapper}>
                <View style={styles.bottomNav}>
                  <View style={styles.navSideGroupLeft}>
                    <TouchableOpacity
                      style={[styles.navItem, homeScreen === 'home' && styles.navItemActive]}
                      onPress={() => { setError(null); setHomeScreen('home'); }}
                    >
                      <MaterialIcons name="home" size={24} color={homeScreen === 'home' ? colors.white : colors.navBarIcon} />
                      <Text style={[styles.navItemText, homeScreen === 'home' && styles.navItemTextActive]} numberOfLines={1}>Home</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.navItem, (homeScreen === 'branches' || homeScreen === 'subscriptionDetail') && styles.navItemActive]}
                      onPress={() => { setError(null); setHomeScreen('branches'); setSelectedSubscriptionId(null); setSubscriptionDetail(null); }}
                    >
                      <MaterialIcons name="storefront" size={24} color={(homeScreen === 'branches' || homeScreen === 'subscriptionDetail') ? colors.white : colors.navBarIcon} />
                      <Text style={[styles.navItemText, (homeScreen === 'branches' || homeScreen === 'subscriptionDetail') && styles.navItemTextActive]} numberOfLines={1}>Branches</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.navCenterSlot} pointerEvents="box-none">
                    <TouchableOpacity
                      style={styles.navBookNowButton}
                      onPress={() => {
                        setError(null);
                        bookingFromSubscriptionRef.current = false;
                        setBookingSubscriptionId(null);
                        setBookingSubscriptionValidFrom(null);
                        setBookingSubscriptionValidTill(null);
                        setBookingStep('services');
                        setSelectedServiceIds([]);
                        setBookingAddressId(null);
                        setBookingAddress(null);
                        setBookingDate('');
                        setBookingTimeSlot('');
                        setSlotAvailability(null);
                        setHomeScreen('bookPickup');
                        fetchOrders();
                      }}
                    >
                      <MaterialIcons name="event-available" size={30} color={colors.white} />
                    </TouchableOpacity>
                    <Text style={styles.navBookNowLabel} numberOfLines={1}>Book Now</Text>
                  </View>
                  <View style={styles.navSideGroupRight}>
                    <TouchableOpacity
                      style={[styles.navItem, homeScreen === 'myOrders' && styles.navItemActive]}
                      onPress={() => { setError(null); setHomeScreen('myOrders'); fetchOrders(); }}
                    >
                      <MaterialIcons name="receipt-long" size={24} color={homeScreen === 'myOrders' ? colors.white : colors.navBarIcon} />
                      <Text style={[styles.navItemText, homeScreen === 'myOrders' && styles.navItemTextActive]} numberOfLines={1}>Orders</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.navItem, homeScreen === 'profile' && styles.navItemActive]}
                      onPress={() => { setError(null); setHomeScreen('profile'); if (token) getMe(token).then((me) => { setName(me.user.name ?? ''); setEmail(me.user.email ?? ''); setUserPhone(me.user.phone ?? ''); }); }}
                    >
                      <MaterialIcons name="person" size={24} color={homeScreen === 'profile' ? colors.white : colors.navBarIcon} />
                      <Text style={[styles.navItemText, homeScreen === 'profile' && styles.navItemTextActive]} numberOfLines={1}>Profile</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={[{ flex: 1 }, isDesktopWeb ? styles.authShellDesktop : undefined, isDesktopWeb && { width: desktopMobileFrameWidth }]}>{content}</View>
          )}
        </KeyboardAvoidingView>
        <Modal visible={feedbackModalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Rate your order</Text>
              <Text style={styles.modalBody}>How was your experience? (1-5 stars)</Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                {[1, 2, 3, 4, 5].map((r) => {
                  const active = feedbackRating != null && feedbackRating >= r;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => !feedbackSubmitting && setFeedbackRating(r)}
                      disabled={feedbackSubmitting}
                      style={{ paddingHorizontal: 6, paddingVertical: 6 }}
                    >
                      <MaterialIcons
                        name={active ? 'star' : 'star-border'}
                        size={34}
                        color={active ? colors.primary : colors.textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {feedbackError ? <Text style={styles.error}>{feedbackError}</Text> : null}

              <TextInput
                style={[styles.input, { marginTop: 14, minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Optional comment"
                value={feedbackComment}
                onChangeText={setFeedbackComment}
                editable={!feedbackSubmitting}
                multiline
              />

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary, styles.modalButton]}
                  onPress={() => setFeedbackModalVisible(false)}
                  disabled={feedbackSubmitting}
                >
                  <Text style={styles.buttonSecondaryText}>Not now</Text>
                </TouchableOpacity>
                <View style={styles.modalButtonSpacer} />
                <TouchableOpacity
                  style={[styles.button, styles.buttonPrimary, styles.modalButton]}
                  disabled={feedbackSubmitting}
                  onPress={handleSubmitOrderFeedback}
                >
                  <Text style={styles.buttonText}>{feedbackSubmitting ? 'Submitting…' : 'Submit'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={!!legalModalContent} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{legalModalContent?.title ?? ''}</Text>
              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
                <Text style={styles.modalBody}>{legalModalContent?.body ?? ''}</Text>
              </ScrollView>
              <TouchableOpacity style={[styles.button, { marginTop: 12 }]} onPress={() => setLegalModalContent(null)}>
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        <Modal
          visible={priceListModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setPriceListModalVisible(false)}
        >
          <View style={styles.notificationsModalOverlay}>
            <TouchableWithoutFeedback onPress={() => setPriceListModalVisible(false)}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
            <View style={styles.notificationsModalCard}>
              <View style={styles.notificationsModalHeader}>
                <View style={styles.notificationsModalTitleRow}>
                  <View style={styles.notificationsModalBellIcon}>
                    <MaterialIcons name="list-alt" size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.notificationsModalTitle}>Price list</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setPriceListModalVisible(false)}
                  style={styles.notificationsModalCloseBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <MaterialIcons name="close" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {priceListLoading ? (
                <View style={styles.priceListState}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.notificationsEmptySubtext}>Loading catalog prices...</Text>
                </View>
              ) : priceListError ? (
                <View style={styles.priceListState}>
                  <Text style={styles.error}>{priceListError}</Text>
                </View>
              ) : priceListItems.length === 0 ? (
                <View style={styles.priceListState}>
                  <Text style={styles.notificationsEmptyText}>No price lines found</Text>
                  <Text style={styles.notificationsEmptySubtext}>Please check again later.</Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.notificationsListScroll}
                  contentContainerStyle={styles.priceListContent}
                  showsVerticalScrollIndicator={true}
                >
                  {priceListItems.map((item) => {
                    const iconUri = item.icon && (item.icon.startsWith('http') || item.icon.startsWith('/'))
                      ? brandingLogoFullUrl(item.icon)
                      : null;
                    return (
                      <View key={item.itemId} style={styles.priceListItemCard}>
                        <View style={styles.priceListItemHeader}>
                          {iconUri ? (
                            <Image source={{ uri: iconUri }} style={styles.priceListItemIcon} />
                          ) : (
                            <View style={styles.priceListItemIconFallback}>
                              <MaterialIcons name="local-laundry-service" size={16} color={colors.primary} />
                            </View>
                          )}
                          <Text style={styles.priceListItemName}>{item.name}</Text>
                        </View>
                        <View style={styles.priceListLines}>
                          {item.lines.map((line, idx) => (
                            <View
                              key={`${item.itemId}-${line.segment}-${line.service}-${idx}`}
                              style={styles.priceListLineRow}
                            >
                              <Text style={styles.priceListLineLabel}>
                                {line.segment} - {line.service}
                              </Text>
                              <Text style={styles.priceListLinePrice}>Rs {line.priceRupees.toFixed(2)}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
        <Modal
          visible={notificationsModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setNotificationsModalVisible(false)}
        >
          <View style={styles.notificationsModalOverlay}>
            <TouchableWithoutFeedback onPress={() => setNotificationsModalVisible(false)}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
            <View style={styles.notificationsModalCard}>
                  <View style={styles.notificationsModalHeader}>
                    <View style={styles.notificationsModalTitleRow}>
                      <View style={styles.notificationsModalBellIcon}>
                        <MaterialIcons name="notifications" size={22} color={colors.primary} />
                      </View>
                      <Text style={styles.notificationsModalTitle}>Notifications</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setNotificationsModalVisible(false)}
                      style={styles.notificationsModalCloseBtn}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <MaterialIcons name="close" size={22} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                  {notificationsList.length === 0 ? (
                    <View style={styles.notificationsEmptyState}>
                      <View style={styles.notificationsEmptyIconWrap}>
                        <MaterialIcons name="notifications-none" size={40} color={colors.textSecondary} />
                      </View>
                      <Text style={styles.notificationsEmptyText}>No notifications yet</Text>
                      <Text style={styles.notificationsEmptySubtext}>Updates will appear here</Text>
                    </View>
                  ) : (
                    <ScrollView
                      style={styles.notificationsListScroll}
                      contentContainerStyle={styles.notificationsListContent}
                      showsVerticalScrollIndicator={true}
                      bounces={true}
                    >
                      {notificationsList.map((n) => (
                        <TouchableOpacity
                          key={n.id}
                          style={styles.notificationRow}
                          onPress={() => {
                            setNotificationsModalVisible(false);
                            if (n.orderId) {
                              setSelectedOrderId(n.orderId);
                              setOrderDetail(null);
                              setOrderInvoices([]);
                              setHomeScreen('orderDetail');
                            } else if (n.subscriptionId) {
                              setSelectedSubscriptionId(n.subscriptionId);
                              setHomeScreen('subscriptionDetail');
                            }
                          }}
                          activeOpacity={0.6}
                        >
                          <View style={styles.notificationRowContent}>
                            <Text style={styles.notificationRowTitle}>{n.title}</Text>
                            <Text style={styles.notificationRowBody}>{n.body}</Text>
                            {n.sortDate ? (
                              <Text style={styles.notificationRowTime}>
                                {n.sortDate.slice(0, 10)}{n.sortDate.length > 10 ? ` · ${n.sortDate.slice(11, 16)}` : ''}
                              </Text>
                            ) : null}
                          </View>
                          <MaterialIcons name="chevron-right" size={22} color={colors.primary} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
            </View>
          </View>
        </Modal>
        {showGoogleMapsPicker && (
          <Modal visible animationType="slide" onRequestClose={() => setShowGoogleMapsPicker(false)}>
            <SafeAreaView style={styles.googleMapsModalContainer}>
              <View style={styles.googleMapsModalHeader}>
                <Text style={styles.googleMapsModalTitle}>Search location</Text>
                <TouchableOpacity onPress={() => setShowGoogleMapsPicker(false)} style={styles.googleMapsCloseBtn}>
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              {Platform.OS === 'web' ? (
                <View style={{ padding: 16, gap: 10 }}>
                  <Text style={styles.error}>Google Maps in-app view is not supported on web.</Text>
                  <Text style={styles.muted}>
                    Use popup map search for PWA. If popup was blocked, click below to reopen it.
                  </Text>
                  <TouchableOpacity
                    style={styles.buttonSecondary}
                    onPress={() => {
                      const w = (globalThis as { window?: { dispatchEvent?: (event: Event) => boolean; CustomEvent?: new (type: string, init?: Record<string, unknown>) => Event } }).window;
                      if (w?.dispatchEvent && w?.CustomEvent) {
                        w.dispatchEvent(new w.CustomEvent('weyou:pwa-map-popup-open'));
                        setShowGoogleMapsPicker(false);
                      }
                    }}
                  >
                    <Text style={styles.buttonSecondaryText}>Open map popup</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <WebView
                  ref={googleMapsWebViewRef}
                  source={{ uri: 'https://www.google.com/maps' }}
                  style={styles.googleMapsWebView}
                  onNavigationStateChange={(nav) => {
                    if (nav?.url) setLastGoogleMapsUrl(nav.url);
                  }}
                  onMessage={(e) => {
                    try {
                      const data = JSON.parse(e.nativeEvent.data);
                      if (data?.type === 'MAPS_URL' && typeof data?.url === 'string' && onMapsUrlReceivedRef.current) {
                        const cb = onMapsUrlReceivedRef.current;
                        onMapsUrlReceivedRef.current = null;
                        cb(data.url);
                      }
                    } catch (_) {}
                  }}
                />
              )}
              <View style={styles.googleMapsModalFooter}>
                <TouchableOpacity
                  style={[styles.button, addFromMapsLoading && styles.buttonDisabled]}
                  disabled={addFromMapsLoading || Platform.OS === 'web'}
                  onPress={() => {
                    setAddFromMapsLoading(true);
                    onMapsUrlReceivedRef.current = async (url: string) => {
                      try {
                        const finalUrl = url || lastGoogleMapsUrl || 'https://www.google.com/maps';
                        await applyGoogleMapsUrlToAddress(finalUrl);
                      } finally {
                        setAddFromMapsLoading(false);
                        setShowGoogleMapsPicker(false);
                        onMapsUrlReceivedRef.current = null;
                      }
                    };
                    const script = `(function(){try{var u=window.location.href;window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'MAPS_URL',url:u}));}catch(e){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type:'MAPS_URL',url:''}));}})();`;
                    googleMapsWebViewRef.current?.injectJavaScript(script);
                    setTimeout(() => {
                      if (onMapsUrlReceivedRef.current) {
                        const cb = onMapsUrlReceivedRef.current;
                        onMapsUrlReceivedRef.current = null;
                        cb(lastGoogleMapsUrl || 'https://www.google.com/maps');
                      }
                    }, 1500);
                  }}
                >
                  <Text style={styles.buttonText}>{addFromMapsLoading ? 'Getting address…' : 'Add to Address'}</Text>
                </TouchableOpacity>
                <Text style={styles.muted}>Address will be auto-filled from the map location when possible.</Text>
              </View>
            </SafeAreaView>
          </Modal>
        )}
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

// Theme: Magenta primary + 5 light pink elevation backgrounds
const colors = {
  primary: '#C2185B',
  primaryLight: '#F8BBD9',
  primaryDark: '#880E4F',
  navBarDark: '#6A0D3E',
  navBarIcon: 'rgba(255,255,255,0.75)',
  elevation0: '#FFF5F9',
  elevation1: '#FFEDF4',
  elevation2: '#FFE4EE',
  elevation3: '#FFDAE8',
  elevation4: '#FFD0E2',
  elevation5: '#FFC6DC',
  white: '#FFFFFF',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  border: '#F5C6DC',
  borderLight: '#FFE0EB',
  error: '#b91c1c',
  success: '#166534',
  successBg: '#f0fdf4',
  successBorder: '#bbf7d0',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.elevation1,
  },
  safeAreaTransparent: {
    backgroundColor: 'transparent',
  },
  authLoadingShell: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: AUTH_SCREEN_BACKGROUND,
  },
  authLoadingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F6EAF4',
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 48,
    backgroundColor: colors.elevation0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  topNavLogo: {
    width: 120,
    height: 36,
    justifyContent: 'center',
  },
  topNavLogoImage: {
    width: 120,
    height: 36,
  },
  topNavLogoText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  topNavBell: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  topNavPriceListButton: {
    height: 34,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  topNavPriceListButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  container: {
    flex: 1,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  containerWithNav: {
    justifyContent: 'flex-start',
  },
  containerAuthBleed: {
    flex: 1,
    width: '100%',
    backgroundColor: 'transparent',
  },
  mainWithNav: {
    flex: 1,
  },
  mainWithNavDesktop: {
    flex: 1,
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
  },
  authShellDesktop: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  contentArea: {
    flex: 1,
    backgroundColor: colors.elevation1,
  },
  homeLayout: {
    flex: 1,
    backgroundColor: colors.elevation1,
  },
  homeMainScroll: {
    flex: 1,
  },
  homeScrollContent: {
    backgroundColor: colors.elevation1,
    paddingBottom: 20,
  },
  homeWelcomeCard: {
    marginTop: 4,
  },
  bottomNavWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 8,
    alignItems: 'center',
    backgroundColor: colors.elevation0,
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.navBarDark,
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 16,
    height: 80,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    position: 'relative',
  },
  navSideGroupLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    columnGap: 12,
  },
  navSideGroupRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    columnGap: 12,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 4,
    minWidth: 56,
  },
  navItemActive: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginHorizontal: 2,
    marginVertical: 2,
  },
  navItemText: {
    fontSize: 11,
    color: colors.navBarIcon,
    fontWeight: '500',
  },
  navItemTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  navCenterSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  navBookNowButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    borderWidth: 6,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -32,
  },
  navBookNowLabel: {
    fontSize: 10,
    color: colors.white,
    fontWeight: '700',
    marginTop: 4,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 18,
    padding: 24,
    marginHorizontal: 12,
    backgroundColor: colors.elevation3,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  activeOrdersSection: {
    marginTop: 4,
    marginBottom: 12,
  },
  noActiveOrdersWrapper: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noActiveOrdersText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeOrdersTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  activeOrdersScroll: {
    paddingHorizontal: 12,
    gap: 12,
    flexDirection: 'row',
    paddingRight: 24,
  },
  activeOrderCard: {
    width: 200,
    minHeight: 160,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.elevation3,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  activeOrderCardLeft: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-start',
  },
  activeOrderCardStatus: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  activeOrderCardTop: {
    flex: 1,
    minHeight: 0,
  },
  activeOrderCardPayment: {
    marginTop: 8,
  },
  activeOrderCardRight: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    paddingLeft: 8,
    minWidth: 100,
  },
  activeOrderId: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  activeOrderTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  activeOrderTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  activeOrderServiceLine: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  activeOrderDateLine: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  activeOrderPaidTickCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeOrderPaidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeOrderPaidText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  activeOrderPaymentFailed: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 4,
  },
  activeOrderToPay: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
    marginBottom: 4,
  },
  activeOrderMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  activeOrderStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  welcomeScreenOuter: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
    backgroundColor: AUTH_SCREEN_BACKGROUND,
  },
  phoneAuthRoot: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: AUTH_SCREEN_BACKGROUND,
  },
  phoneAuthBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  phoneAuthCard: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 560 : 420,
    alignSelf: 'center',
    backgroundColor: '#FFD0E2',
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
    minHeight: Platform.OS === 'web' ? 560 : 0,
  },
  phoneAuthLogoWrap: {
    width: '100%',
    height: Platform.OS === 'web' ? 220 : 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  phoneAuthLogo: {
    width: Platform.OS === 'web' ? 220 : 230,
    height: '100%',
  },
  phoneAuthLogoFallback: {
    width: Platform.OS === 'web' ? 220 : 230,
    height: '100%',
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneAuthLogoFallbackText: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 1,
  },
  phoneAuthInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    marginTop: 0,
  },
  phoneAuthCountryCodeInput: {
    width: 62,
    minWidth: 62,
    maxWidth: 62,
    marginRight: 6,
    marginBottom: 0,
    paddingHorizontal: 6,
    textAlign: 'center',
    flexShrink: 0,
    height: 52,
  },
  phoneAuthMobileInput: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
    height: 52,
  },
  phoneAuthTermsBlock: {
    marginTop: 12,
    marginBottom: 14,
  },
  phoneAuthSubmitBtn: {
    marginTop: 0,
  },
  phoneAuthCreditRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  welcomeCard: {
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 14,
    marginHorizontal: 0,
    backgroundColor: '#FFD0E2',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
    alignSelf: 'center',
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 560 : 420,
    minHeight: 0,
  },
  welcomeHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  welcomeLogoFrame: {
    width: '100%',
    height: Platform.OS === 'web' ? 220 : 110,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  welcomeLogo: {
    width: Platform.OS === 'web' ? 220 : 230,
    height: '100%',
    marginBottom: 0,
  },
  welcomeLogoPlaceholder: {
    width: Platform.OS === 'web' ? 220 : 230,
    height: '100%',
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  welcomeLogoPlaceholderText: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 1,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  termsPrivacyBlock: {
    marginTop: 12,
    marginBottom: Platform.OS === 'web' ? 8 : 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkboxRowTouchable: {
    alignSelf: 'stretch',
  },
  checkboxTouchTarget: {
    padding: 4,
    margin: -4,
  },
  termsCheckbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  termsCheckboxChecked: {
    backgroundColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  linkText: {
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalButtonRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
  },
  modalButtonSpacer: {
    width: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  modalBody: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  notificationsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  notificationsModalCard: {
    backgroundColor: colors.elevation1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    maxHeight: '80%',
    overflow: 'hidden',
    paddingBottom: 16,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  notificationsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.elevation0,
  },
  notificationsModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationsModalBellIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  notificationsModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevation2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  notificationsEmptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  notificationsEmptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.elevation2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  notificationsEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  notificationsEmptySubtext: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  notificationsListScroll: {
    maxHeight: 360,
    flexGrow: 0,
  },
  notificationsListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 12,
    backgroundColor: colors.elevation2,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  notificationRowContent: {
    flex: 1,
    minWidth: 0,
  },
  notificationRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  notificationRowBody: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  notificationRowTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  priceListState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 10,
  },
  priceListContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 10,
  },
  priceListItemCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.elevation2,
    padding: 12,
  },
  priceListItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  priceListItemIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
  },
  priceListItemIconFallback: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  priceListItemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  priceListLines: {
    gap: 6,
  },
  priceListLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 8,
    backgroundColor: colors.elevation0,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  priceListLineLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  priceListLinePrice: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  orderDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  orderDetailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  orderDetailValue: {
    fontSize: 14,
    color: '#000000',
    flex: 1,
  },
  statusChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  statusChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: colors.elevation2,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  inputReadOnly: {
    backgroundColor: colors.elevation1,
    color: colors.textSecondary,
  },
  /** Login phone row: keep both fields inside the card on narrow widths (e.g. Galaxy Z Fold). */
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0,
    marginTop: 6,
    marginBottom: 0,
  },
  countryCodeInput: {
    width: 62,
    minWidth: 62,
    maxWidth: 62,
    marginRight: 6,
    marginBottom: 0,
    paddingHorizontal: 6,
    textAlign: 'center',
    flexShrink: 0,
    height: 52,
  },
  mobileInput: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
    height: 52,
  },
  datePickerButton: {
    justifyContent: 'center',
    borderColor: colors.primaryLight,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
  datePickerPlaceholder: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  webCalendarBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  webCalendarCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    width: '100%',
    maxWidth: 340,
    maxHeight: 460,
  },
  webCalendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  webCalendarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  webCalendarNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.elevation2,
  },
  webCalendarNavText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  webCalendarWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  webCalendarWeekText: {
    flex: 1,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  webCalendarDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  webCalendarDayCell: {
    width: '14.2857%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 2,
  },
  webCalendarDayText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  webCalendarDaySelected: {
    backgroundColor: colors.primary,
  },
  webCalendarDayTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  webCalendarHolidayDay: {
    backgroundColor: '#fff1f2',
  },
  webCalendarHolidayText: {
    color: '#dc2626',
    fontWeight: '700',
  },
  webCalendarDayDisabled: {
    opacity: 0.55,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 2,
  },
  rowButton: {
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: colors.elevation2,
  },
  buttonSecondaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  textButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  textButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  profileLogoutButton: {
    marginTop: 24,
    borderColor: colors.error,
  },
  profileLogoutText: {
    color: colors.error,
    fontWeight: '600',
  },
  profileAccountSettingsRow: {
    marginTop: 4,
  },
  profileAccountSettingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  profileAccountSettingText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  error: {
    color: colors.error,
    marginBottom: 8,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  orderFilterRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  orderFilterChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.elevation2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  orderFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  orderFilterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  orderFilterChipTextActive: {
    color: colors.white,
  },
  plansTabToggle: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.elevation2,
    padding: 3,
  },
  plansTabToggleSegment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plansTabToggleSegmentActive: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  plansTabToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  plansTabToggleTextActive: {
    color: colors.primaryDark,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.elevation1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingVertical: 24,
    paddingBottom: 48,
    backgroundColor: colors.elevation1,
  },
  scrollContentNoTopPadding: {
    paddingTop: 0,
  },
  confirmScrollContent: {
    paddingBottom: 120,
  },
  confirmSummaryCard: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.elevation0,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  confirmSummaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  confirmSummaryLabelInline: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  confirmSummaryValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 4,
  },
  confirmSummarySubValue: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 10,
    lineHeight: 20,
  },
  confirmMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  confirmSummaryHighlight: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '700',
  },
  floatingSubmitWrapper: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  floatingSubmitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 28,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },
  floatingSubmitText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  carouselWrapper: {
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: 4,
  },
  carouselContent: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  carouselSlide: {
    overflow: 'hidden',
    backgroundColor: colors.elevation2,
    alignSelf: 'stretch',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  serviceTile: {
    width: '47%',
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.elevation2,
    padding: 16,
    justifyContent: 'center',
  },
  serviceTileSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.elevation3,
  },
  serviceIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  serviceIconImage: {
    width: 42,
    height: 42,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  serviceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  serviceLabelSelected: {
    color: colors.text,
  },
  muted: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  creditNote: {
    marginTop: 0,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'left',
    flexShrink: 1,
  },
  creditRow: {
    marginTop: 'auto',
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  creditRowOnDark: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  creditNoteOnDark: {
    marginTop: 0,
    fontSize: 11,
    color: '#F6EAF4',
    textAlign: 'left',
    flexShrink: 1,
  },
  creditLogo: {
    width: 22,
    height: 22,
  },
  addressCard: {
    padding: 12,
    backgroundColor: colors.elevation2,
    borderRadius: 8,
    marginBottom: 10,
  },
  branchPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  branchPickerLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  branchPickerLogoInitial: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  branchPickerLogoInitialText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  branchPickerName: {
    flex: 1,
    marginBottom: 0,
  },
  activePlanTile: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: colors.elevation2,
    borderRadius: 12,
  },
  activePlanTileTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  activePlanTileSubtext: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 6,
  },
  plansPageWrapper: {
    marginHorizontal: 12,
    padding: 24,
  },
  contentPageWrapper: {
    marginHorizontal: 12,
    padding: 24,
  },
  plansSubtitleOneLine: {
    marginBottom: 8,
  },
  availablePlansScroll: {
    marginHorizontal: -36,
    marginBottom: 16,
  },
  availablePlansScrollContent: {
    paddingLeft: 36,
    paddingRight: 0,
  },
  availablePlanTile: {
    width: 260,
    height: 180,
    marginRight: 12,
    overflow: 'hidden',
  },
  availablePlanTileInner: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    justifyContent: 'space-between',
  },
  availablePlanTilePurchased: {
    backgroundColor: colors.primaryLight,
  },
  availablePlanTileTitleLight: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  availablePlanTileDescLight: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 4,
  },
  availablePlanTileMetaLight: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  availablePlansHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  availablePlansTitle: {
    fontWeight: '600',
    flexShrink: 0,
    color: '#000000',
  },
  availablePlansBranchTag: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    flexShrink: 0,
  },
  plansAddressSection: {
    marginBottom: 12,
  },
  plansAddressSectionHighlight: {
    backgroundColor: colors.primaryLight,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  addressCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.elevation2,
    borderRadius: 8,
    marginBottom: 8,
  },
  editAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingLeft: 12,
  },
  editAddressButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  defaultAddressTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultAddressTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  deleteAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingLeft: 8,
  },
  deleteAddressButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
  googleMapsOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.elevation2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  googleMapsOpenText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  googleMapsModalContainer: {
    flex: 1,
    backgroundColor: colors.elevation0,
  },
  googleMapsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.elevation1,
  },
  googleMapsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  googleMapsCloseBtn: {
    padding: 4,
  },
  googleMapsWebView: {
    flex: 1,
    backgroundColor: colors.elevation0,
  },
  googleMapsModalFooter: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.elevation1,
  },
  orderTileCard: {
    position: 'relative',
  },
  orderTileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  orderTileOrderId: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
  },
  orderTileTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexShrink: 0,
  },
  orderTileTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
  },
  orderTileStatusRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  orderTileStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  orderTileStatusCancelled: {
    color: colors.error,
  },
  addressLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  orderAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
    marginTop: 6,
  },
  orderAmountPaidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  paidTickCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderAmountPaid: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  amountToPayBox: {
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    backgroundColor: colors.successBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  amountToPayLabel: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
    marginBottom: 4,
  },
  amountToPayValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#14532d',
  },
  amountPaidBox: {
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    backgroundColor: colors.elevation3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  amountPaidBoxGradient: {
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  paidTickCircleOnGreen: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountPaidLabelOnGradient: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '600',
    marginBottom: 4,
  },
  amountPaidValueOnGradient: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  amountPaidMutedOnGradient: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  amountPaidLabel: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  amountPaidValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  invoiceRow: {
    marginBottom: 12,
  },
  invoiceTypeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  invoiceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.elevation2,
  },
  invoiceItemIcon: {
    width: 24,
    height: 24,
    marginRight: 8,
    borderRadius: 4,
  },
  invoiceItemName: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 12,
  },
  invoiceItemNameNoIcon: {},
  invoiceItemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  invoiceTotals: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  invoiceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  invoiceTotalLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  invoiceTotalValue: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  invoiceTotalRowFinal: {
    marginTop: 6,
    marginBottom: 0,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  invoiceTotalLabelFinal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  invoiceTotalValueFinal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  invoiceActions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  invoicePreviewContainer: {
    height: 360,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.elevation2,
  },
  invoicePreviewWebView: {
    flex: 1,
  },
  invoiceCta: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  invoiceCtaDownload: {
    backgroundColor: colors.elevation2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  invoiceCtaShare: {
    backgroundColor: colors.primary,
  },
  invoiceCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  addressLine: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  addressPincode: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  link: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 4,
  },
  serviceabilityBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  serviceabilityBoxNotServiceable: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  serviceableText: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '500',
  },
  notServiceableText: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '600',
    marginBottom: 4,
  },
  notServiceableSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  areaRequestButton: {
    marginTop: 4,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
    minHeight: 44,
  },
  checkbox: {
    fontSize: 28,
    marginRight: 12,
    minWidth: 36,
    minHeight: 36,
    textAlignVertical: 'center',
  },
  checkLabel: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
});
