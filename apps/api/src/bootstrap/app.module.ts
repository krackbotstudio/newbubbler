import { Module } from '@nestjs/common';
import { InfraModule } from '../infra/infra.module';
import { AuthModule } from '../api/auth/auth.module';
import { OrdersModule } from '../api/orders/orders.module';
import { InvoicesModule } from '../api/invoices/invoices.module';
import { FeedbackModule } from '../api/feedback/feedback.module';
import { AdminModule } from '../api/admin/admin.module';
import { ItemsModule } from '../api/items/items.module';
import { SubscriptionPlansModule } from '../api/subscription-plans/subscription-plans.module';
import { SubscriptionsModule } from '../api/subscriptions/subscriptions.module';
import { AddressesModule } from '../api/addresses/addresses.module';
import { ServiceabilityModule } from '../api/serviceability/serviceability.module';
import { AssetsModule } from '../api/assets/assets.module';
import { BrandingModule } from '../api/branding/branding.module';
import { CarouselModule } from '../api/carousel/carousel.module';
import { SlotsModule } from '../api/slots/slots.module';
import { PortalModule } from '../api/portal/portal.module';

@Module({
  imports: [
    InfraModule,
    AuthModule,
    OrdersModule,
    InvoicesModule,
    FeedbackModule,
    AdminModule,
    ItemsModule,
    SubscriptionPlansModule,
    SubscriptionsModule,
    AddressesModule,
    ServiceabilityModule,
    SlotsModule,
    AssetsModule,
    BrandingModule,
    CarouselModule,
    PortalModule,
  ],
})
export class AppModule {}

