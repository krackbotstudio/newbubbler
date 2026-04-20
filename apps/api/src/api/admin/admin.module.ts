import { Module } from '@nestjs/common';
import { AdminOrdersController } from './controllers/admin-orders.controller';
import { AdminCatalogController } from './controllers/admin-catalog.controller';
import { AdminCatalogMatrixController } from './controllers/admin-catalog-matrix.controller';
import { AdminSubscriptionPlansController } from './controllers/admin-subscription-plans.controller';
import { AdminBranchesController } from './controllers/admin-branches.controller';
import { AdminBrandingController } from './controllers/admin-branding.controller';
import { AdminCarouselController } from './controllers/admin-carousel.controller';
import { AdminServiceAreasController } from './controllers/admin-service-areas.controller';
import { AdminInvoicesController } from './controllers/admin-invoices.controller';
import { AdminSubscriptionsController } from './controllers/admin-subscriptions.controller';
import { AdminFinalInvoicesController } from './controllers/admin-final-invoices.controller';
import { AdminPaymentsController } from './controllers/admin-payments.controller';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminCustomersController } from './controllers/admin-customers.controller';
import { AdminSystemController } from './controllers/admin-system.controller';
import { AdminTestController } from './controllers/admin-test.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminHolidaysController } from './controllers/admin-holidays.controller';
import { AdminOperatingHoursController } from './controllers/admin-operating-hours.controller';
import { WalkInController } from './controllers/walk-in.controller';
import { AdminCustomerPortalsController } from './controllers/admin-customer-portals.controller';
import { AdminOrdersService } from './services/admin-orders.service';
import { WalkInService } from './services/walk-in.service';
import { AdminCatalogService } from './services/admin-catalog.service';
import { AdminSubscriptionPlansService } from './services/admin-subscription-plans.service';
import { AdminBranchesService } from './services/admin-branches.service';
import { AdminBrandingService } from './services/admin-branding.service';
import { AdminCarouselService } from './services/admin-carousel.service';
import { AdminServiceAreasService } from './services/admin-service-areas.service';
import { AdminInvoicesService } from './services/admin-invoices.service';
import { AdminSubscriptionsService } from './services/admin-subscriptions.service';
import { AdminFinalInvoicesService } from './services/admin-final-invoices.service';
import { AdminPaymentsService } from './services/admin-payments.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminCustomersService } from './services/admin-customers.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminHolidaysService } from './services/admin-holidays.service';
import { AdminOperatingHoursService } from './services/admin-operating-hours.service';
import { DbInfoService } from './services/db-info.service';
import { AdminCustomerPortalsService } from './services/admin-customer-portals.service';

@Module({
  controllers: [
    AdminOrdersController,
    AdminCatalogController,
    AdminCatalogMatrixController,
    AdminSubscriptionPlansController,
    AdminBranchesController,
    AdminBrandingController,
    AdminCarouselController,
    AdminServiceAreasController,
    AdminInvoicesController,
    AdminSubscriptionsController,
    AdminFinalInvoicesController,
    AdminPaymentsController,
    AdminAnalyticsController,
    AdminCustomersController,
    AdminUsersController,
    AdminHolidaysController,
    AdminOperatingHoursController,
    WalkInController,
    AdminTestController,
    AdminSystemController,
    AdminCustomerPortalsController,
  ],
  providers: [
    DbInfoService,
    AdminOrdersService,
    WalkInService,
    AdminCatalogService,
    AdminSubscriptionPlansService,
    AdminBranchesService,
    AdminBrandingService,
    AdminCarouselService,
    AdminServiceAreasService,
    AdminInvoicesService,
    AdminSubscriptionsService,
    AdminFinalInvoicesService,
    AdminPaymentsService,
    AdminAnalyticsService,
    AdminCustomersService,
    AdminUsersService,
    AdminHolidaysService,
    AdminOperatingHoursService,
    AdminCustomerPortalsService,
  ],
})
export class AdminModule {}
