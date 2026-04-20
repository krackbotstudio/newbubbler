import { Module, Global } from '@nestjs/common';
import { prisma } from './prisma/prisma-client';
import { PrismaUnitOfWork } from './prisma/unit-of-work';
import {
  PrismaOrdersRepo,
  PrismaSubscriptionsRepo,
  PrismaSubscriptionUsageRepo,
  PrismaInvoicesRepo,
  PrismaPaymentsRepo,
  PrismaAddressesRepo,
  PrismaServiceAreaRepo,
  PrismaSlotConfigRepo,
  PrismaHolidaysRepo,
  PrismaOperatingHoursRepo,
  PrismaBranchRepo,
  PrismaBrandingRepo,
  PrismaCarouselRepo,
  PrismaLaundryItemBranchRepo,
  PrismaLaundryItemsRepo,
  PrismaLaundryItemPricesRepo,
  PrismaServiceCategoryRepo,
  PrismaSegmentCategoryRepo,
  PrismaItemSegmentServicePriceRepo,
  PrismaSubscriptionPlansRepo,
  PrismaCustomersRepo,
  PrismaAnalyticsRepo,
  PrismaFeedbackRepo,
  PrismaAdminUsersRepo,
  PrismaCustomerPortalsRepo,
} from './prisma/repos';
import type {
  OrdersRepo,
  SubscriptionsRepo,
  SubscriptionUsageRepo,
  InvoicesRepo,
  PaymentsRepo,
  UnitOfWork,
  AddressesRepo,
  ServiceAreaRepo,
  SlotConfigRepo,
  HolidaysRepo,
  OperatingHoursRepo,
  BranchRepo,
  BrandingRepo,
  CarouselRepo,
  LaundryItemBranchRepo,
  LaundryItemsRepo,
  LaundryItemPricesRepo,
  ServiceCategoryRepo,
  SegmentCategoryRepo,
  ItemSegmentServicePriceRepo,
  SubscriptionPlansRepo,
  CustomersRepo,
  AnalyticsRepo,
  FeedbackRepo,
  AdminUsersRepo,
  CustomerPortalsRepo,
  StorageAdapter,
  PdfGenerator,
} from '../application/ports';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { SupabaseStorageAdapter } from './storage/supabase-storage.adapter';
import { SimplePdfGenerator } from './pdf/simple-pdf.generator';

export const ORDERS_REPO = Symbol('OrdersRepo');
export const SUBSCRIPTIONS_REPO = Symbol('SubscriptionsRepo');
export const SUBSCRIPTION_USAGE_REPO = Symbol('SubscriptionUsageRepo');
export const INVOICES_REPO = Symbol('InvoicesRepo');
export const PAYMENTS_REPO = Symbol('PaymentsRepo');
export const UNIT_OF_WORK = Symbol('UnitOfWork');
export const ADDRESSES_REPO = Symbol('AddressesRepo');
export const SERVICE_AREA_REPO = Symbol('ServiceAreaRepo');
export const SLOT_CONFIG_REPO = Symbol('SlotConfigRepo');
export const HOLIDAYS_REPO = Symbol('HolidaysRepo');
export const OPERATING_HOURS_REPO = Symbol('OperatingHoursRepo');
export const BRANCH_REPO = Symbol('BranchRepo');
export const BRANDING_REPO = Symbol('BrandingRepo');
export const CAROUSEL_REPO = Symbol('CarouselRepo');
export const LAUNDRY_ITEM_BRANCH_REPO = Symbol('LaundryItemBranchRepo');
export const LAUNDRY_ITEMS_REPO = Symbol('LaundryItemsRepo');
export const LAUNDRY_ITEM_PRICES_REPO = Symbol('LaundryItemPricesRepo');
export const SERVICE_CATEGORY_REPO = Symbol('ServiceCategoryRepo');
export const SEGMENT_CATEGORY_REPO = Symbol('SegmentCategoryRepo');
export const ITEM_SEGMENT_SERVICE_PRICE_REPO = Symbol('ItemSegmentServicePriceRepo');
export const SUBSCRIPTION_PLANS_REPO = Symbol('SubscriptionPlansRepo');
export const CUSTOMERS_REPO = Symbol('CustomersRepo');
export const ANALYTICS_REPO = Symbol('AnalyticsRepo');
export const FEEDBACK_REPO = Symbol('FeedbackRepo');
export const ADMIN_USERS_REPO = Symbol('AdminUsersRepo');
export const CUSTOMER_PORTALS_REPO = Symbol('CustomerPortalsRepo');
export const STORAGE_ADAPTER = Symbol('StorageAdapter');
export const PDF_GENERATOR = Symbol('PdfGenerator');

@Global()
@Module({
  providers: [
    {
      provide: ORDERS_REPO,
      useFactory: (): OrdersRepo => new PrismaOrdersRepo(prisma),
    },
    {
      provide: SUBSCRIPTIONS_REPO,
      useFactory: (): SubscriptionsRepo => new PrismaSubscriptionsRepo(prisma),
    },
    {
      provide: SUBSCRIPTION_USAGE_REPO,
      useFactory: (): SubscriptionUsageRepo => new PrismaSubscriptionUsageRepo(prisma),
    },
    {
      provide: INVOICES_REPO,
      useFactory: (): InvoicesRepo => new PrismaInvoicesRepo(prisma),
    },
    {
      provide: UNIT_OF_WORK,
      useFactory: (): UnitOfWork => new PrismaUnitOfWork(prisma),
    },
    {
      provide: ADDRESSES_REPO,
      useFactory: (): AddressesRepo => new PrismaAddressesRepo(prisma),
    },
    {
      provide: SERVICE_AREA_REPO,
      useFactory: (): ServiceAreaRepo => new PrismaServiceAreaRepo(prisma),
    },
    {
      provide: SLOT_CONFIG_REPO,
      useFactory: (): SlotConfigRepo => new PrismaSlotConfigRepo(prisma),
    },
    {
      provide: HOLIDAYS_REPO,
      useFactory: (): HolidaysRepo => new PrismaHolidaysRepo(prisma),
    },
    {
      provide: OPERATING_HOURS_REPO,
      useFactory: (): OperatingHoursRepo => new PrismaOperatingHoursRepo(prisma),
    },
    {
      provide: PAYMENTS_REPO,
      useFactory: (): PaymentsRepo => new PrismaPaymentsRepo(prisma),
    },
    {
      provide: BRANCH_REPO,
      useFactory: (): BranchRepo => new PrismaBranchRepo(prisma),
    },
    {
      provide: BRANDING_REPO,
      useFactory: (): BrandingRepo => new PrismaBrandingRepo(prisma),
    },
    {
      provide: CAROUSEL_REPO,
      useFactory: (): CarouselRepo => new PrismaCarouselRepo(prisma),
    },
    {
      provide: LAUNDRY_ITEM_BRANCH_REPO,
      useFactory: (): LaundryItemBranchRepo => new PrismaLaundryItemBranchRepo(prisma),
    },
    {
      provide: LAUNDRY_ITEMS_REPO,
      useFactory: (): LaundryItemsRepo => new PrismaLaundryItemsRepo(prisma),
    },
    {
      provide: LAUNDRY_ITEM_PRICES_REPO,
      useFactory: (): LaundryItemPricesRepo => new PrismaLaundryItemPricesRepo(prisma),
    },
    {
      provide: SERVICE_CATEGORY_REPO,
      useFactory: (): ServiceCategoryRepo => new PrismaServiceCategoryRepo(prisma),
    },
    {
      provide: SEGMENT_CATEGORY_REPO,
      useFactory: (): SegmentCategoryRepo => new PrismaSegmentCategoryRepo(prisma),
    },
    {
      provide: ITEM_SEGMENT_SERVICE_PRICE_REPO,
      useFactory: (): ItemSegmentServicePriceRepo => new PrismaItemSegmentServicePriceRepo(prisma),
    },
    {
      provide: SUBSCRIPTION_PLANS_REPO,
      useFactory: (): SubscriptionPlansRepo => new PrismaSubscriptionPlansRepo(prisma),
    },
    {
      provide: CUSTOMERS_REPO,
      useFactory: (): CustomersRepo => new PrismaCustomersRepo(prisma),
    },
    {
      provide: ANALYTICS_REPO,
      useFactory: (): AnalyticsRepo => new PrismaAnalyticsRepo(prisma),
    },
    {
      provide: FEEDBACK_REPO,
      useFactory: (): FeedbackRepo => new PrismaFeedbackRepo(prisma),
    },
    {
      provide: ADMIN_USERS_REPO,
      useFactory: (): AdminUsersRepo => new PrismaAdminUsersRepo(prisma),
    },
    {
      provide: CUSTOMER_PORTALS_REPO,
      useFactory: (): CustomerPortalsRepo => new PrismaCustomerPortalsRepo(prisma),
    },
    {
      provide: STORAGE_ADAPTER,
      useFactory: (): StorageAdapter => {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'assets';
        if (url && key) {
          return new SupabaseStorageAdapter({ url, serviceRoleKey: key, bucket });
        }
        return new LocalStorageAdapter(process.env.LOCAL_STORAGE_ROOT ?? './storage');
      },
    },
    {
      provide: PDF_GENERATOR,
      useFactory: (): PdfGenerator => new SimplePdfGenerator(),
    },
  ],
  exports: [
    ORDERS_REPO,
    SUBSCRIPTIONS_REPO,
    SUBSCRIPTION_USAGE_REPO,
    INVOICES_REPO,
    PAYMENTS_REPO,
    UNIT_OF_WORK,
    ADDRESSES_REPO,
    SERVICE_AREA_REPO,
    SLOT_CONFIG_REPO,
    HOLIDAYS_REPO,
    OPERATING_HOURS_REPO,
    BRANCH_REPO,
    BRANDING_REPO,
    CAROUSEL_REPO,
    LAUNDRY_ITEM_BRANCH_REPO,
    LAUNDRY_ITEMS_REPO,
    LAUNDRY_ITEM_PRICES_REPO,
    SERVICE_CATEGORY_REPO,
    SEGMENT_CATEGORY_REPO,
    ITEM_SEGMENT_SERVICE_PRICE_REPO,
    SUBSCRIPTION_PLANS_REPO,
    CUSTOMERS_REPO,
    ANALYTICS_REPO,
    FEEDBACK_REPO,
    ADMIN_USERS_REPO,
    CUSTOMER_PORTALS_REPO,
    STORAGE_ADAPTER,
    PDF_GENERATOR,
  ],
})
export class InfraModule {}
