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
  ) {}

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
  }): Promise<{ orderId: string; orderType?: string }> {
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
        branchId: dto.branchId?.trim() || null,
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

  async listForCustomer(user: AuthUser): Promise<Array<OrderRecord & { amountToPayPaise: number | null }>> {
    return this.ordersRepo.listByUserForCustomer(user.id);
  }

  async getOrderForUser(user: AuthUser, id: string): Promise<OrderRecord> {
    const order = await this.ordersRepo.getById(id);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND', 'Order not found', { orderId: id });
    }
    if (user.role === 'CUSTOMER' && order.userId !== user.id) {
      throw new AppError('ORDER_ACCESS_DENIED', 'Not allowed to view this order');
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

