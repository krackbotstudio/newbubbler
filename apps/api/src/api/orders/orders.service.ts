import { Inject, Injectable } from '@nestjs/common';
import { OrderStatus, OrderType } from '@shared/enums';
import { createOrder } from '../../application/orders/create-order.use-case';
import { updateOrderStatus } from '../../application/orders/update-order-status.use-case';
import { createOrderFeedback } from '../../application/feedback/create-order-feedback.use-case';
import { checkFeedbackEligibility } from '../../application/feedback/check-feedback-eligibility.use-case';
import { listInvoicesForOrder } from '../../application/invoices/list-invoices-for-order.use-case';
import { sendExpoPush } from '../../infra/expo-push';
import type {
  OrdersRepo,
  SubscriptionsRepo,
  SubscriptionUsageRepo,
  UnitOfWork,
  OrderRecord,
  AddressesRepo,
  ServiceAreaRepo,
  SlotConfigRepo,
  HolidaysRepo,
  OperatingHoursRepo,
  FeedbackRepo,
  InvoicesRepo,
  LaundryItemsRepo,
  SegmentCategoryRepo,
  ServiceCategoryRepo,
  CustomersRepo,
  CustomerPortalsRepo,
} from '../../application/ports';
import {
  ORDERS_REPO,
  SUBSCRIPTIONS_REPO,
  SUBSCRIPTION_USAGE_REPO,
  UNIT_OF_WORK,
  ADDRESSES_REPO,
  SERVICE_AREA_REPO,
  SLOT_CONFIG_REPO,
  HOLIDAYS_REPO,
  OPERATING_HOURS_REPO,
  FEEDBACK_REPO,
  INVOICES_REPO,
  LAUNDRY_ITEMS_REPO,
  SEGMENT_CATEGORY_REPO,
  SERVICE_CATEGORY_REPO,
  CUSTOMERS_REPO,
  CUSTOMER_PORTALS_REPO,
} from '../../infra/infra.module';
import type { AuthUser } from '../common/roles.guard';
import { AppError } from '../../application/errors';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDERS_REPO) private readonly ordersRepo: OrdersRepo,
    @Inject(SUBSCRIPTIONS_REPO) private readonly subscriptionsRepo: SubscriptionsRepo,
    @Inject(SUBSCRIPTION_USAGE_REPO) private readonly subscriptionUsageRepo: SubscriptionUsageRepo,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(ADDRESSES_REPO) private readonly addressesRepo: AddressesRepo,
    @Inject(SERVICE_AREA_REPO) private readonly serviceAreaRepo: ServiceAreaRepo,
    @Inject(SLOT_CONFIG_REPO) private readonly slotConfigRepo: SlotConfigRepo,
    @Inject(HOLIDAYS_REPO) private readonly holidaysRepo: HolidaysRepo,
    @Inject(OPERATING_HOURS_REPO) private readonly operatingHoursRepo: OperatingHoursRepo,
    @Inject(FEEDBACK_REPO) private readonly feedbackRepo: FeedbackRepo,
    @Inject(INVOICES_REPO) private readonly invoicesRepo: InvoicesRepo,
    @Inject(LAUNDRY_ITEMS_REPO) private readonly laundryItemsRepo: LaundryItemsRepo,
    @Inject(SEGMENT_CATEGORY_REPO) private readonly segmentCategoryRepo: SegmentCategoryRepo,
    @Inject(SERVICE_CATEGORY_REPO) private readonly serviceCategoryRepo: ServiceCategoryRepo,
    @Inject(CUSTOMERS_REPO) private readonly customersRepo: CustomersRepo,
    @Inject(CUSTOMER_PORTALS_REPO) private readonly customerPortalsRepo: CustomerPortalsRepo,
  ) {}

  private async resolvePortalScopeForCustomer(
    userId: string,
    rawHost?: string,
    slugHint?: string,
  ): Promise<{ portalId: string; branchId: string } | null> {
    const hinted = (slugHint ?? '').trim().toLowerCase();
    const host = (rawHost ?? '').split(',')[0]?.trim().toLowerCase().split(':')[0] ?? '';
    const parts = host.split('.');
    const hostSlug =
      parts.length >= 4 && parts.slice(-3).join('.') === 'bubbler.krackbot.com'
        ? parts.slice(0, -3).join('.')
        : '';
    const slug = hinted || hostSlug;
    if (!slug) return null;
    const portal = await this.customerPortalsRepo.getByAccessKey(slug);
    if (!portal || !portal.isActive) {
      throw new AppError('NOT_FOUND', 'Portal not found');
    }
    const isMember = await this.customerPortalsRepo.isMember(portal.id, userId);
    if (!isMember) {
      throw new AppError('FORBIDDEN', 'Join portal before accessing customer data');
    }
    return { portalId: portal.id, branchId: portal.branchId };
  }

  async listInvoicesForOrder(orderId: string, user: AuthUser) {
    return listInvoicesForOrder(orderId, user.id, {
      ordersRepo: this.ordersRepo,
      invoicesRepo: this.invoicesRepo,
      laundryItemsRepo: this.laundryItemsRepo,
      segmentCategoryRepo: this.segmentCategoryRepo,
      serviceCategoryRepo: this.serviceCategoryRepo,
    });
  }

  async createForCustomer(user: AuthUser, dto: {
    orderType?: 'INDIVIDUAL' | 'SUBSCRIPTION';
    serviceType?: OrderRecord['serviceType'];
    services?: OrderRecord['serviceType'][];
    selectedServices?: OrderRecord['serviceType'][];
    addressId: string;
    pickupDate: string;
    timeWindow: string;
    estimatedWeightKg?: number;
    subscriptionId?: string;
    branchId?: string;
  }, rawHost?: string, slugHint?: string): Promise<{ orderId: string; orderType?: string }> {
    const portalScope = await this.resolvePortalScopeForCustomer(user.id, rawHost, slugHint);
    const orderType =
      dto.orderType === 'SUBSCRIPTION' ? OrderType.SUBSCRIPTION
        : OrderType.INDIVIDUAL;
    const serviceTypes =
      dto.selectedServices?.length ? dto.selectedServices
        : dto.services?.length ? dto.services
          : dto.serviceType ? [dto.serviceType] : [];
    if (orderType === OrderType.INDIVIDUAL && serviceTypes.length === 0) {
      throw new AppError('SERVICES_REQUIRED', 'At least one service is required');
    }
    const pickupDate = new Date(dto.pickupDate);
    const address = await this.addressesRepo.getById(dto.addressId);
    if (!address) {
      throw new AppError('ADDRESS_NOT_FOUND', 'Address not found', {
        addressId: dto.addressId,
      });
    }
    if (address.userId !== user.id) {
      throw new AppError('ADDRESS_NOT_OWNED', 'Cannot use this address', {
        addressId: dto.addressId,
      });
    }

    const requestedBranchId = dto.branchId?.trim() || null;
    const effectiveBranchId = portalScope ? portalScope.branchId : requestedBranchId;

    const result = await createOrder(
      {
        userId: user.id,
        orderType,
        serviceType: (serviceTypes[0] ?? 'WASH_FOLD') as OrderRecord['serviceType'],
        services: serviceTypes.length ? serviceTypes : (['WASH_FOLD'] as OrderRecord['serviceType'][]),
        addressId: dto.addressId,
        pincode: address.pincode,
        pickupDate,
        timeWindow: dto.timeWindow,
        estimatedWeightKg: dto.estimatedWeightKg ?? null,
        subscriptionId: dto.subscriptionId ?? null,
        branchId: effectiveBranchId,
      },
      {
        ordersRepo: this.ordersRepo,
        subscriptionsRepo: this.subscriptionsRepo,
        subscriptionUsageRepo: this.subscriptionUsageRepo,
        unitOfWork: this.unitOfWork,
        serviceAreaRepo: this.serviceAreaRepo,
        slotConfigRepo: this.slotConfigRepo,
        holidaysRepo: this.holidaysRepo,
        operatingHoursRepo: this.operatingHoursRepo,
        addressesRepo: this.addressesRepo,
      },
    );
    sendExpoPush(this.customersRepo, user.id, {
      title: 'Booking confirmed',
      body: `Your order has been placed successfully.`,
      data: { orderId: result.orderId },
    }).catch(() => {});

    return { orderId: result.orderId, orderType };
  }

  async listForCustomer(
    user: AuthUser,
    rawHost?: string,
    slugHint?: string,
  ): Promise<Array<OrderRecord & { amountToPayPaise: number | null }>> {
    const portalScope = await this.resolvePortalScopeForCustomer(user.id, rawHost, slugHint);
    const list = await this.ordersRepo.listByUserForCustomer(user.id);
    if (!portalScope) return list;
    return list.filter((o) => o.branchId != null && o.branchId === portalScope.branchId);
  }

  async getOrderForUser(user: AuthUser, id: string, rawHost?: string, slugHint?: string): Promise<OrderRecord> {
    const order = await this.ordersRepo.getById(id);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND', 'Order not found', { orderId: id });
    }
    if (user.role === 'CUSTOMER' && order.userId !== user.id) {
      throw new AppError('ORDER_ACCESS_DENIED', 'Not allowed to view this order');
    }
    if (user.role === 'CUSTOMER') {
      const portalScope = await this.resolvePortalScopeForCustomer(user.id, rawHost, slugHint);
      if (portalScope) {
        if (!order.branchId || order.branchId !== portalScope.branchId) {
          throw new AppError('ORDER_ACCESS_DENIED', 'Order is outside this portal');
        }
      }
    }
    return order;
  }

  async updateStatusAsAdmin(
    id: string,
    status: OrderStatus,
    options?: { cancellationReason?: string | null },
  ): Promise<{ orderId: string; status: OrderStatus }> {
    const order = await this.ordersRepo.getById(id);
    const result = await updateOrderStatus(
      { orderId: id, toStatus: status, cancellationReason: options?.cancellationReason },
      { ordersRepo: this.ordersRepo },
    );

    if (order?.userId) {
      const statusMessages: Partial<Record<OrderStatus, { title: string; body: string }>> = {
        [OrderStatus.PICKED_UP]: { title: 'Order picked up', body: 'Your laundry has been picked up.' },
        [OrderStatus.IN_PROCESSING]: { title: 'In progress', body: 'Your laundry is being processed.' },
        [OrderStatus.READY]: { title: 'Ready for delivery', body: 'Your laundry is ready and will be delivered soon.' },
        [OrderStatus.OUT_FOR_DELIVERY]: { title: 'Out for delivery', body: 'Your laundry is on the way!' },
        [OrderStatus.DELIVERED]: { title: 'Delivered', body: 'Your laundry has been delivered. Thank you!' },
        [OrderStatus.CANCELLED]: { title: 'Order cancelled', body: 'Your order has been cancelled.' },
      };
      const msg = statusMessages[status];
      if (msg) {
        sendExpoPush(this.customersRepo, order.userId, {
          ...msg,
          data: { orderId: id },
        }).catch(() => {});
      }
    }

    return result;
  }

  async getFeedbackEligibility(orderId: string, user: AuthUser) {
    return checkFeedbackEligibility(orderId, user.id, {
      ordersRepo: this.ordersRepo,
      feedbackRepo: this.feedbackRepo,
    });
  }

  async submitOrderFeedback(
    orderId: string,
    user: AuthUser,
    body: { rating: number; tags?: string[]; message?: string },
  ) {
    return createOrderFeedback(
      {
        userId: user.id,
        orderId,
        rating: body.rating,
        tags: body.tags,
        message: body.message,
      },
      { ordersRepo: this.ordersRepo, feedbackRepo: this.feedbackRepo },
    );
  }
}

