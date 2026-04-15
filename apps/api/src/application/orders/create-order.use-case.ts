import { ServiceType, OrderType } from '@shared/enums';
import { AppError } from '../errors';
import type {
  OrdersRepo,
  SubscriptionsRepo,
  SubscriptionUsageRepo,
  UnitOfWork,
  ServiceAreaRepo,
  SlotConfigRepo,
  SlotIdentifier,
  HolidaysRepo,
  OperatingHoursRepo,
  AddressesRepo,
} from '../ports';
import { indiaDayRange, toIndiaDateKey } from '../time/india-date';
import { isTimeWindowWithin } from '../time/time-window';
import { getSlotStartInIndia } from '../time/slot-helper';

const DEFAULT_SLOT_CAPACITY = 100;

export interface CreateOrderParams {
  userId: string;
  /** Order type; defaults to INDIVIDUAL when omitted (backward compat). */
  orderType?: OrderType;
  serviceType: ServiceType;
  /** Multi-select services; when provided must have at least one. Primary serviceType can be first element. */
  services?: ServiceType[];
  addressId: string;
  pincode: string;
  pickupDate: Date;
  timeWindow: string;
  estimatedWeightKg?: number | null;
  subscriptionId?: string | null;
  /** Individual orders: optional branch that must actively serve `pincode`. Ignored for subscription orders. */
  branchId?: string | null;
}

export interface CreateOrderDeps {
  ordersRepo: OrdersRepo;
  subscriptionsRepo: SubscriptionsRepo;
  subscriptionUsageRepo: SubscriptionUsageRepo;
  /** When provided and subscriptionId is set, create + usage + decrement run in a single transaction. */
  unitOfWork?: UnitOfWork;
  serviceAreaRepo: ServiceAreaRepo;
  slotConfigRepo: SlotConfigRepo;
  holidaysRepo: HolidaysRepo;
  operatingHoursRepo: OperatingHoursRepo;
  addressesRepo: AddressesRepo;
}

export async function createOrder(
  params: CreateOrderParams,
  deps: CreateOrderDeps,
): Promise<{ orderId: string }> {
  const {
    ordersRepo,
    subscriptionsRepo,
    serviceAreaRepo,
    slotConfigRepo,
    holidaysRepo,
    operatingHoursRepo,
    addressesRepo,
  } = deps;

  const orderType = params.orderType ?? OrderType.INDIVIDUAL;
  let subscriptionForAddress: { id: string; addressId: string | null; branchId: string | null } | null = null;

  // Server-side: slot must not be in the past
  const slotStart = getSlotStartInIndia(params.pickupDate, params.timeWindow);
  if (slotStart) {
    const now = new Date();
    if (slotStart.getTime() < now.getTime()) {
      throw new AppError(
        'SLOT_IN_THE_PAST',
        'Pickup date and time cannot be in the past. Please select a future slot.',
        { pickupDate: params.pickupDate, timeWindow: params.timeWindow },
      );
    }
  }

  let serviceTypes: ServiceType[];
  let primaryServiceType: ServiceType;

  if (orderType === OrderType.SUBSCRIPTION) {
    // Subscription order: must use existing subscription (purchased first in customer console)
    if (!params.subscriptionId) {
      throw new AppError('SUBSCRIPTION_REQUIRED', 'Subscription is required. Purchase a subscription first to book a subscription order.');
    }
    const sub = await subscriptionsRepo.getById(params.subscriptionId);
    if (!sub) {
      throw new AppError('SUBSCRIPTION_EXPIRED', 'Subscription not found. Purchase a subscription first to book a subscription order.');
    }
    if (sub.userId !== params.userId) {
      throw new AppError('SUBSCRIPTION_NOT_OWNED', 'Subscription does not belong to this customer');
    }
    if (!sub.active) {
      throw new AppError('SUBSCRIPTION_EXPIRED', 'Subscription is not active');
    }
    if (sub.expiryDate < new Date()) {
      throw new AppError('SUBSCRIPTION_EXPIRED', 'Subscription has expired');
    }
    if (sub.remainingPickups < 1) {
      throw new AppError('NO_REMAINING_PICKUPS', 'No pickups remaining on subscription');
    }
    const activeOrder = await ordersRepo.findActiveBySubscriptionId(params.subscriptionId);
    if (activeOrder) {
      throw new AppError(
        'SUBSCRIPTION_HAS_ACTIVE_ORDER',
        'You already have an active order with this subscription. Please wait until it is delivered to book again.',
        { subscriptionId: params.subscriptionId, activeOrderId: activeOrder.id },
      );
    }
    primaryServiceType = ServiceType.WASH_FOLD;
    serviceTypes = [ServiceType.WASH_FOLD];
    subscriptionForAddress = { id: params.subscriptionId!, addressId: sub.addressId, branchId: sub.branchId };
  } else {
    if (params.subscriptionId) {
      throw new AppError('INDIVIDUAL_NO_SUBSCRIPTION', 'Subscription ID must not be set for individual booking');
    }
    serviceTypes =
      params.services && params.services.length > 0
        ? params.services
        : Array.isArray(params.services) && params.services.length === 0
          ? []
          : [params.serviceType];
    if (!serviceTypes.length) {
      throw new AppError('SERVICES_REQUIRED', 'At least one service is required for individual booking');
    }
    primaryServiceType = serviceTypes[0]!;
  }

  // Resolve address and branch: for subscription orders with locked address, use subscription's address and branch
  let effectiveAddressId = params.addressId;
  let effectivePincode = params.pincode;
  let branchId: string | null = null;
  /** Snapshot of address at order time (label + addressLine) so it doesn't change if user edits/deletes address. */
  let addressSnapshot: { label: string | null; addressLine: string } | null = null;

  if (subscriptionForAddress?.addressId && subscriptionForAddress?.branchId) {
    const subAddress = await addressesRepo.getByIdForUser(subscriptionForAddress.addressId, params.userId);
    if (!subAddress) {
      throw new AppError('SUBSCRIPTION_ADDRESS_INVALID', 'This subscription is tied to an address that no longer exists.');
    }
    effectiveAddressId = subscriptionForAddress.addressId;
    effectivePincode = subAddress.pincode;
    branchId = subscriptionForAddress.branchId;
    addressSnapshot = { label: subAddress.label?.trim() ?? null, addressLine: subAddress.addressLine?.trim() ?? '' };
  } else {
    const address = await addressesRepo.getByIdForUser(effectiveAddressId, params.userId);
    if (address) {
      addressSnapshot = { label: address.label?.trim() ?? null, addressLine: address.addressLine?.trim() ?? '' };
    }
  }

  if (branchId === null) {
    const serviceable = await serviceAreaRepo.isServiceable(effectivePincode);
    if (!serviceable) {
      throw new AppError(
        'PINCODE_NOT_SERVICEABLE',
        `Pincode ${effectivePincode} is not serviceable`,
        { pincode: effectivePincode },
      );
    }
    const preferred = params.branchId?.trim();
    if (preferred) {
      const areas = await serviceAreaRepo.listActiveByPincode(effectivePincode);
      const hit = areas.find((a) => a.branchId === preferred);
      if (!hit) {
        throw new AppError(
          'BRANCH_NOT_SERVING_PINCODE',
          'This branch does not serve your address pincode.',
          { pincode: effectivePincode, branchId: preferred },
        );
      }
      branchId = hit.branchId;
    } else {
      const area = await serviceAreaRepo.getByPincode(effectivePincode);
      branchId = area?.branchId ?? null;
    }
  }

  // Holiday check (common + branch-specific)
  const isHoliday = await holidaysRepo.isHoliday(params.pickupDate, branchId ?? undefined);
  if (isHoliday) {
    throw new AppError(
      'SLOT_NOT_AVAILABLE',
      'We are closed on this date (holiday). Please choose another day.',
      { date: toIndiaDateKey(params.pickupDate) },
    );
  }

  // Slot validation (date-only + timeWindow + pincode)
  const dateKey = toIndiaDateKey(params.pickupDate);
  const { start: dayStart } = indiaDayRange(dateKey);
  const slotId: SlotIdentifier = {
    date: dayStart,
    timeWindow: params.timeWindow,
    pincode: effectivePincode,
  };

  let slot = await slotConfigRepo.getSlot(slotId);
  if (!slot) {
    // If no explicit slot, allow booking if within operating hours (create slot on the fly)
    const hours = await operatingHoursRepo.get(branchId ?? undefined);
    if (hours && isTimeWindowWithin(hours.startTime, hours.endTime, params.timeWindow)) {
      slot = await slotConfigRepo.createSlot(slotId, DEFAULT_SLOT_CAPACITY);
    } else {
      throw new AppError(
        'SLOT_NOT_AVAILABLE',
        hours
          ? `No slot available for selected time. We are open ${hours.startTime}–${hours.endTime}.`
          : 'No slot available for selected time. Ask admin to set operating hours or create slots.',
        { slot: slotId },
      );
    }
  }

  const existingCount = await slotConfigRepo.countOrdersForSlot(slotId);
  if (existingCount >= slot.capacity) {
    throw new AppError(
      'SLOT_FULL',
      'Selected slot is full',
      { slot: slotId, existingCount, capacity: slot.capacity },
    );
  }

  const createInput = {
    userId: params.userId,
    orderType: params.orderType ?? OrderType.INDIVIDUAL,
    serviceType: primaryServiceType,
    serviceTypes,
    addressId: effectiveAddressId,
    addressLabel: addressSnapshot?.label ?? null,
    addressLine: addressSnapshot?.addressLine ?? null,
    pincode: effectivePincode,
    pickupDate: params.pickupDate,
    timeWindow: params.timeWindow,
    estimatedWeightKg: params.estimatedWeightKg ?? null,
    subscriptionId: params.subscriptionId ?? null,
    branchId, // Branch serving this pincode (subscription orders use subscription's branch)
    orderSource: 'ONLINE', // Customer app (mobile) – distinct from WALK_IN / Admin simulation
  };

  // Subscription is linked to order but deduction happens at ACK (pickup confirmation), not here.
  const order = await ordersRepo.create(createInput);
  return { orderId: order.id };
}
