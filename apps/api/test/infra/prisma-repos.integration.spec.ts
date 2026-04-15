/**
 * Prisma repo integration tests. Require DATABASE_URL (or DATABASE_URL_TEST) and a clean DB.
 * Run with: npm test -- prisma-repos.integration
 * Skip if no DB: set SKIP_DB_TESTS=1 or omit DATABASE_URL.
 */
import { PrismaClient, SubscriptionVariant } from '@prisma/client';
import { OrderStatus, ServiceType } from '@shared/enums';
import { AppError, isAppError } from '../../src/application/errors';
import { PrismaOrdersRepo } from '../../src/infra/prisma/repos/prisma-orders-repo';
import { PrismaSubscriptionUsageRepo } from '../../src/infra/prisma/repos/prisma-subscription-usage-repo';

const databaseUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
const skipDbTests = process.env.SKIP_DB_TESTS === '1' || !databaseUrl;

const describeIfDb = skipDbTests ? describe.skip : describe;

describeIfDb('Prisma repos (integration)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.subscriptionUsage.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.address.deleteMany({});
    await prisma.user.deleteMany({});
  });

  it('updateStatus persists', async () => {
    const user = await prisma.user.create({
      data: {
        phone: '+919999999001',
        role: 'CUSTOMER',
      },
    });
    const address = await prisma.address.create({
      data: {
        userId: user.id,
        label: 'Home',
        addressLine: 'Street',
        pincode: '500081',
        isDefault: true,
      },
    });
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        addressId: address.id,
        serviceType: ServiceType.WASH_FOLD,
        pincode: '500081',
        pickupDate: new Date(),
        timeWindow: '10:00-12:00',
        estimatedWeightKg: 4,
        status: OrderStatus.BOOKING_CONFIRMED,
      },
    });

    const repo = new PrismaOrdersRepo(prisma);
    const updated = await repo.updateStatus(order.id, OrderStatus.PICKUP_SCHEDULED);
    expect(updated.status).toBe(OrderStatus.PICKUP_SCHEDULED);

    const fromDb = await prisma.order.findUnique({ where: { id: order.id } });
    expect(fromDb?.status).toBe(OrderStatus.PICKUP_SCHEDULED);
  });

  it('SubscriptionUsage create twice for same orderId maps to AppError UNIQUE_CONSTRAINT', async () => {
    const user = await prisma.user.create({
      data: { phone: '+919999999002', role: 'CUSTOMER' },
    });
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: 'Plan A',
        validityDays: 30,
        maxPickups: 2,
        variant: SubscriptionVariant.SINGLE,
        pricePaise: 100,
        minKgPerPickup: 3,
        applicableServiceTypes: [ServiceType.WASH_FOLD],
        active: true,
      },
    });
    const sub = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        remainingPickups: 2,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        active: true,
      },
    });
    const address = await prisma.address.create({
      data: {
        userId: user.id,
        label: 'Home',
        addressLine: 'Street',
        pincode: '500081',
        isDefault: true,
      },
    });
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        addressId: address.id,
        serviceType: ServiceType.WASH_FOLD,
        pincode: '500081',
        pickupDate: new Date(),
        timeWindow: '10:00-12:00',
        estimatedWeightKg: 4,
        status: OrderStatus.BOOKING_CONFIRMED,
      },
    });

    const usageRepo = new PrismaSubscriptionUsageRepo(prisma);
    await usageRepo.create({
      subscriptionId: sub.id,
      orderId: order.id,
      deductedPickups: 1,
    });

    let err: unknown;
    try {
      await usageRepo.create({
        subscriptionId: sub.id,
        orderId: order.id,
        deductedPickups: 1,
      });
    } catch (e) {
      err = e;
    }
    expect(isAppError(err)).toBe(true);
    expect((err as AppError).code).toBe('UNIQUE_CONSTRAINT');
  });
});
