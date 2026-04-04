/**
 * Idempotent seed script.
 * Run after migrations: npm run prisma:seed
 */
import 'dotenv/config';
// Prisma client is generated to apps/api (see schema.prisma `output`); scripts/ have no @prisma/client path alias.
import {
  PrismaClient,
  Role,
  ServiceType,
  PricingMode,
  SubscriptionVariant,
  InvoiceType,
  InvoiceStatus,
  InvoiceItemType,
  PaymentProvider,
  PaymentStatus,
  OrderStatus,
  FeedbackType as FbType,
  FeedbackStatus as FbStatus,
} from '../apps/api/src/infra/generated/prisma-client';
import {
  getIndiaDates,
  getIndiaNowPlusDays,
} from './seed-utils';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with demo data...');

  // --- A) Users -------------------------------------------------------------
  const customerPhone = '+919999999999';
  const adminEmail = 'admin@laundry.local';
  const billingEmail = 'billing@laundry.local';
  const weyouAdminEmail = 'weyou@admin.com';

  const customerUser = await prisma.user.upsert({
    where: { phone: customerPhone },
    update: {
      role: Role.CUSTOMER,
    },
    create: {
      phone: customerPhone,
      role: Role.CUSTOMER,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: Role.ADMIN,
      passwordHash: 'dev-hash',
    },
    create: {
      email: adminEmail,
      passwordHash: 'dev-hash',
      role: Role.ADMIN,
    },
  });

  const billingUser = await prisma.user.upsert({
    where: { email: billingEmail },
    update: {
      role: Role.BILLING,
      passwordHash: 'dev-hash',
    },
    create: {
      email: billingEmail,
      passwordHash: 'dev-hash',
      role: Role.BILLING,
    },
  });

  // Protected admin account (used by admin console); restore if deleted.
  const weyouAdmin = await prisma.user.upsert({
    where: { email: weyouAdminEmail },
    update: {
      role: Role.ADMIN,
      passwordHash: 'dev-hash',
      isActive: true,
    },
    create: {
      email: weyouAdminEmail,
      passwordHash: 'dev-hash',
      role: Role.ADMIN,
    },
  });

  // --- B) BrandingSettings (single row) ------------------------------------
  const branding = await prisma.brandingSettings.upsert({
    where: { id: 'branding-default' },
    update: {
      businessName: 'Laundry Demo',
      address: 'Demo Address',
      phone: '+91-9000000000',
      footerNote: 'Thank you!',
      upiId: 'merchant@upi',
      upiPayeeName: 'Laundry Demo',
      upiLink: null,
      upiQrUrl: null,
    },
    create: {
      id: 'branding-default',
      businessName: 'Laundry Demo',
      address: 'Demo Address',
      phone: '+91-9000000000',
      footerNote: 'Thank you!',
      upiId: 'merchant@upi',
      upiPayeeName: 'Laundry Demo',
      upiLink: null,
      upiQrUrl: null,
    },
  });

  // --- C) Branch (required for ServiceArea) ----------------------------------
  const defaultBranch = await prisma.branch.upsert({
    where: { id: 'branch-default' },
    update: {
      name: 'Demo Branch',
      address: 'Demo Address',
      phone: '+91-9000000000',
    },
    create: {
      id: 'branch-default',
      name: 'Demo Branch',
      address: 'Demo Address',
      phone: '+91-9000000000',
    },
  });

  // --- D) ServiceArea -------------------------------------------------------
  const pincode = '500081';
  const serviceArea = await prisma.serviceArea.upsert({
    where: { pincode },
    update: {
      active: true,
      branchId: defaultBranch.id,
    },
    create: {
      pincode,
      active: true,
      branchId: defaultBranch.id,
    },
  });

  // --- E) SlotConfig for today + tomorrow (Asia/Kolkata safe) --------------
  const { todayDate, tomorrowDate, todayStr, tomorrowStr } = getIndiaDates();

  async function upsertSlot(date: Date, timeWindow: string, capacity: number) {
    const existing = await prisma.slotConfig.findFirst({
      where: {
        date,
        timeWindow,
        pincode,
      },
    });

    if (existing) {
      if (existing.capacity !== capacity) {
        await prisma.slotConfig.update({
          where: { id: existing.id },
          data: { capacity },
        });
      }
      return existing;
    }

    return prisma.slotConfig.create({
      data: {
        date,
        timeWindow,
        pincode,
        capacity,
      },
    });
  }

  const todaySlot1 = await upsertSlot(todayDate, '10:00-12:00', 10);
  const todaySlot2 = await upsertSlot(todayDate, '14:00-16:00', 10);
  const tomorrowSlot1 = await upsertSlot(tomorrowDate, '10:00-12:00', 10);

  // --- E) ServicePriceConfig ------------------------------------------------
  const washFoldPrice = await prisma.servicePriceConfig.upsert({
    where: { serviceType: ServiceType.WASH_FOLD },
    update: {
      pricingMode: PricingMode.PER_KG,
      pricePerKg: 1000,
      minimumKg: 3.0,
      pickupFee: 0,
      active: true,
    },
    create: {
      serviceType: ServiceType.WASH_FOLD,
      pricingMode: PricingMode.PER_KG,
      pricePerKg: 1000,
      minimumKg: 3.0,
      pickupFee: 0,
      active: true,
    },
  });

  const washIronPrice = await prisma.servicePriceConfig.upsert({
    where: { serviceType: ServiceType.WASH_IRON },
    update: {
      pricingMode: PricingMode.PER_KG,
      pricePerKg: 1500,
      minimumKg: 3.0,
      pickupFee: 0,
      active: true,
    },
    create: {
      serviceType: ServiceType.WASH_IRON,
      pricingMode: PricingMode.PER_KG,
      pricePerKg: 1500,
      minimumKg: 3.0,
      pickupFee: 0,
      active: true,
    },
  });

  // --- F) DryCleanItem (no unique on name; use findFirst then update/create) ---
  const shirt = await prisma.dryCleanItem.findFirst({ where: { name: 'Shirt' } }).then((row) =>
    row
      ? prisma.dryCleanItem.update({ where: { id: row.id }, data: { unitPrice: 800, active: true } })
      : prisma.dryCleanItem.create({ data: { name: 'Shirt', unitPrice: 800, active: true } }),
  );
  const suit = await prisma.dryCleanItem.findFirst({ where: { name: 'Suit' } }).then((row) =>
    row
      ? prisma.dryCleanItem.update({ where: { id: row.id }, data: { unitPrice: 2500, active: true } })
      : prisma.dryCleanItem.create({ data: { name: 'Suit', unitPrice: 2500, active: true } }),
  );
  const dress = await prisma.dryCleanItem.findFirst({ where: { name: 'Dress' } }).then((row) =>
    row
      ? prisma.dryCleanItem.update({ where: { id: row.id }, data: { unitPrice: 1800, active: true } })
      : prisma.dryCleanItem.create({ data: { name: 'Dress', unitPrice: 1800, active: true } }),
  );

  // --- LaundryItem + LaundryItemPrice (for ACK/FINAL itemized billing) -------
  const itemShirt = await prisma.laundryItem.upsert({
    where: { name: 'Shirt' },
    update: { active: true },
    create: { name: 'Shirt', active: true },
  });
  const itemJeans = await prisma.laundryItem.upsert({
    where: { name: 'Jeans' },
    update: { active: true },
    create: { name: 'Jeans', active: true },
  });
  for (const st of [ServiceType.WASH_FOLD, ServiceType.WASH_IRON, ServiceType.DRY_CLEAN]) {
    await prisma.laundryItemPrice.upsert({
      where: {
        itemId_serviceType: { itemId: itemShirt.id, serviceType: st },
      },
      update: { unitPricePaise: st === 'DRY_CLEAN' ? 800 : st === 'WASH_IRON' ? 1500 : 1000, active: true },
      create: {
        itemId: itemShirt.id,
        serviceType: st,
        unitPricePaise: st === 'DRY_CLEAN' ? 800 : st === 'WASH_IRON' ? 1500 : 1000,
        active: true,
      },
    });
    await prisma.laundryItemPrice.upsert({
      where: {
        itemId_serviceType: { itemId: itemJeans.id, serviceType: st },
      },
      update: { unitPricePaise: st === 'DRY_CLEAN' ? 600 : st === 'WASH_IRON' ? 1200 : 800, active: true },
      create: {
        itemId: itemJeans.id,
        serviceType: st,
        unitPricePaise: st === 'DRY_CLEAN' ? 600 : st === 'WASH_IRON' ? 1200 : 800,
        active: true,
      },
    });
  }

  // --- SegmentCategory (default segments) ---
  const segmentCategoryLabels: Record<string, string> = {
    MEN: 'Men',
    WOMEN: 'Women',
    KIDS: 'Kids',
    HOME_LINEN: 'Home Linen',
  };
  for (const code of ['MEN', 'WOMEN', 'KIDS', 'HOME_LINEN']) {
    await prisma.segmentCategory.upsert({
      where: { code },
      update: { label: segmentCategoryLabels[code] ?? code, isActive: true },
      create: {
        code,
        label: segmentCategoryLabels[code] ?? code,
        isActive: true,
      },
    });
  }
  // --- ServiceCategory (from ServiceType) + ItemSegmentServicePrice backfill ---
  const serviceCategoryLabels: Record<string, string> = {
    WASH_FOLD: 'Wash & Fold',
    WASH_IRON: 'Wash & Iron',
    STEAM_IRON: 'Steam Ironing',
    DRY_CLEAN: 'Dry Cleaning',
    HOME_LINEN: 'Home Linen',
    SHOES: 'Shoes',
    ADD_ONS: 'Add ons',
  };
  const serviceTypeValues = Object.values(ServiceType) as string[];
  for (const code of serviceTypeValues) {
    await prisma.serviceCategory.upsert({
      where: { code },
      update: { label: serviceCategoryLabels[code] ?? code, isActive: true },
      create: {
        code,
        label: serviceCategoryLabels[code] ?? code,
        isActive: true,
      },
    });
  }
  // Backfill ItemSegmentServicePrice from LaundryItemPrice (default segment MEN)
  const menSegment = await prisma.segmentCategory.findUnique({ where: { code: 'MEN' } });
  if (menSegment) {
    const allPrices = await prisma.laundryItemPrice.findMany();
    const categories = await prisma.serviceCategory.findMany();
    const categoryByCode = new Map(categories.map((c) => [c.code, c]));
    for (const p of allPrices) {
      const cat = categoryByCode.get(p.serviceType);
      if (!cat) continue;
      await prisma.itemSegmentServicePrice.upsert({
        where: {
          itemId_segmentCategoryId_serviceCategoryId: {
            itemId: p.itemId,
            segmentCategoryId: menSegment.id,
            serviceCategoryId: cat.id,
          },
        },
        update: { priceRupees: Math.round(p.unitPricePaise / 100), isActive: p.active },
        create: {
          itemId: p.itemId,
          segmentCategoryId: menSegment.id,
          serviceCategoryId: cat.id,
          priceRupees: Math.round(p.unitPricePaise / 100),
          isActive: p.active,
        },
      });
    }
  }

  // --- G) SubscriptionPlan --------------------------------------------------
  const planId = 'plan-single-12kg-monthly';
  const plan = await prisma.subscriptionPlan.upsert({
    where: { id: planId },
    update: {
      name: 'Single (12kg) Monthly',
      variant: SubscriptionVariant.SINGLE,
      validityDays: 30,
      maxPickups: 2,
      kgLimit: 12.0,
      itemsLimit: null,
      minKgPerPickup: 3.0,
      pricePaise: 49900,
      applicableServiceTypes: [ServiceType.WASH_FOLD],
      active: true,
    },
    create: {
      id: planId,
      name: 'Single (12kg) Monthly',
      variant: SubscriptionVariant.SINGLE,
      validityDays: 30,
      maxPickups: 2,
      kgLimit: 12.0,
      itemsLimit: null,
      minKgPerPickup: 3.0,
      pricePaise: 49900,
      applicableServiceTypes: [ServiceType.WASH_FOLD],
      active: true,
    },
  });

  // --- H) Subscription for CUSTOMER ----------------------------------------
  const expiryDate = getIndiaNowPlusDays(30);

  let subscription = await prisma.subscription.findFirst({
    where: {
      userId: customerUser.id,
      planId: plan.id,
    },
  });

  if (subscription) {
    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        remainingPickups: 2,
        expiryDate,
        active: true,
      },
    });
  } else {
    subscription = await prisma.subscription.create({
      data: {
        userId: customerUser.id,
        planId: plan.id,
        remainingPickups: 2,
        expiryDate,
        active: true,
      },
    });
  }

  // --- I) Address for CUSTOMER ---------------------------------------------
  let customerAddress = await prisma.address.findFirst({
    where: {
      userId: customerUser.id,
      label: 'Home',
    },
  });

  if (customerAddress) {
    customerAddress = await prisma.address.update({
      where: { id: customerAddress.id },
      data: {
        addressLine: 'Demo House, Demo Street',
        pincode,
        isDefault: true,
      },
    });
  } else {
    customerAddress = await prisma.address.create({
      data: {
        userId: customerUser.id,
        label: 'Home',
        addressLine: 'Demo House, Demo Street',
        pincode,
        isDefault: true,
      },
    });
  }

  // --- J) Delivered order + FINAL issued invoice + CAPTURED payment (analytics) -
  const pastDate = new Date(todayDate);
  pastDate.setDate(pastDate.getDate() - 2);
  let deliveredOrder = await prisma.order.findFirst({
    where: { userId: customerUser.id, status: OrderStatus.DELIVERED },
  });
  if (!deliveredOrder) {
    deliveredOrder = await prisma.order.create({
      data: {
        userId: customerUser.id,
        addressId: customerAddress.id,
        serviceType: ServiceType.WASH_FOLD,
        pincode,
        pickupDate: pastDate,
        timeWindow: '10:00-12:00',
        estimatedWeightKg: 5,
        actualWeightKg: 5,
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.CAPTURED,
      },
    });
    const finalTotalPaise = 14000; // 5000 + 9000 from items
    await prisma.payment.create({
      data: {
        orderId: deliveredOrder.id,
        provider: PaymentProvider.CASH,
        status: PaymentStatus.CAPTURED,
        amount: finalTotalPaise,
      },
    });
    const inv = await prisma.invoice.create({
      data: {
        orderId: deliveredOrder.id,
        type: InvoiceType.FINAL,
        status: InvoiceStatus.ISSUED,
        subtotal: finalTotalPaise,
        tax: 0,
        total: finalTotalPaise,
        issuedAt: new Date(),
        brandingSnapshotJson: {
          businessName: branding.businessName,
          address: branding.address,
          phone: branding.phone,
          upiId: branding.upiId,
          upiPayeeName: branding.upiPayeeName,
        },
        items: {
          create: [
            { type: InvoiceItemType.SERVICE, name: 'Wash & Fold', quantity: 5, unitPrice: 1000, amount: 5000 },
            { type: InvoiceItemType.SERVICE, name: 'Wash & Fold', quantity: 9, unitPrice: 1000, amount: 9000 },
          ],
        },
      },
      include: { items: true },
    });
    // Ensure PDF URL pattern for issued invoice
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { pdfUrl: `/api/invoices/${inv.id}/pdf` },
    });
  }

  // --- K) Sample feedback for delivered order (optional) --------------------
  const existingFeedback = deliveredOrder
    ? await prisma.feedback.findUnique({ where: { orderId: deliveredOrder.id } })
    : null;
  if (deliveredOrder && !existingFeedback) {
    await prisma.feedback.create({
      data: {
        userId: customerUser.id,
        orderId: deliveredOrder.id,
        type: FbType.ORDER,
        rating: 5,
        tags: ['quality', 'delivery'],
        message: 'Great service!',
        status: FbStatus.REVIEWED,
      },
    });
  }

  // --- Output summary -------------------------------------------------------
  console.log('Seed completed with:');
  console.log({
    customerUserId: customerUser.id,
    adminUserId: adminUser.id,
    billingUserId: billingUser.id,
    weyouAdminUserId: weyouAdmin.id,
    customerAddressId: customerAddress.id,
    brandingId: branding.id,
    serviceAreaId: serviceArea.id,
    planId: plan.id,
    subscriptionId: subscription.id,
    pincode,
    today: todayStr,
    tomorrow: tomorrowStr,
    todaySlotIds: [todaySlot1.id, todaySlot2.id],
    tomorrowSlotId: tomorrowSlot1.id,
    dryCleanItemIds: {
      shirt: shirt.id,
      suit: suit.id,
      dress: dress.id,
    },
    servicePriceConfigIds: {
      washFold: washFoldPrice.id,
      washIron: washIronPrice.id,
    },
  });

  console.log('Next: run npm run prisma:seed then npm run prisma:studio');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    if (e?.name === 'PrismaClientInitializationError' && e?.message?.includes("Can't reach database server")) {
      console.error('\nDatabase unreachable. Check:');
      console.error('  1. DATABASE_URL in .env (e.g. from Supabase dashboard)');
      console.error('  2. Database server is running (Supabase project not paused)');
      console.error('  3. Network / firewall allows connection to the host:port\n');
    }
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
