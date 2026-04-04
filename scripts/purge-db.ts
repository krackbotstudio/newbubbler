/**
 * Purge transactional and sample data from the database.
 * Keeps: ADMIN/OPS/BILLING/AGENT users (isActive=true), master data (categories, branding, branches, etc.).
 * Requires: PURGE_CONFIRM=YES
 *
 * Run from repo root:
 *   PURGE_CONFIRM=YES npx ts-node --transpile-only --project scripts/tsconfig.seed.json scripts/purge-db.ts
 */
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_ROLES = [Role.ADMIN, Role.OPS, Role.BILLING, Role.AGENT] as const;

interface Counts {
  Feedback: number;
  InvoiceItem: number;
  Invoice: number;
  Payment: number;
  SubscriptionUsage: number;
  OrderItem: number;
  Order: number;
  Subscription: number;
  Address_customer: number;
  User_customer: number;
  User_admin: number;
}

async function getCounts(): Promise<Counts> {
  const [
    feedback,
    invoiceItem,
    invoice,
    payment,
    subscriptionUsage,
    orderItem,
    order,
    subscription,
    addressCustomer,
    userCustomer,
    userAdmin,
  ] = await Promise.all([
    prisma.feedback.count(),
    prisma.invoiceItem.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.subscriptionUsage.count(),
    prisma.orderItem.count(),
    prisma.order.count(),
    prisma.subscription.count(),
    prisma.address.count({ where: { user: { role: Role.CUSTOMER } } }),
    prisma.user.count({ where: { role: Role.CUSTOMER } }),
    prisma.user.count({ where: { role: { in: [...ADMIN_ROLES] }, isActive: true } }),
  ]);
  return {
    Feedback: feedback,
    InvoiceItem: invoiceItem,
    Invoice: invoice,
    Payment: payment,
    SubscriptionUsage: subscriptionUsage,
    OrderItem: orderItem,
    Order: order,
    Subscription: subscription,
    Address_customer: addressCustomer,
    User_customer: userCustomer,
    User_admin: userAdmin,
  };
}

function printCounts(label: string, counts: Counts): void {
  console.log(`\n--- ${label} ---`);
  console.log('  Feedback:', counts.Feedback);
  console.log('  InvoiceItem:', counts.InvoiceItem);
  console.log('  Invoice:', counts.Invoice);
  console.log('  Payment:', counts.Payment);
  console.log('  SubscriptionUsage:', counts.SubscriptionUsage);
  console.log('  OrderItem:', counts.OrderItem);
  console.log('  Order:', counts.Order);
  console.log('  Subscription:', counts.Subscription);
  console.log('  Address (customer):', counts.Address_customer);
  console.log('  User (customer):', counts.User_customer);
  console.log('  User (ADMIN/OPS/BILLING/AGENT, active):', counts.User_admin, '(kept)');
}

async function purge(): Promise<void> {
  if (process.env.PURGE_CONFIRM !== 'YES') {
    console.error('Aborted: set PURGE_CONFIRM=YES to run purge.');
    process.exit(1);
  }

  console.log('Purging transactional/customer data (keeping admin users and master data)...');

  const beforeCounts = await getCounts();
  printCounts('Before', beforeCounts);

  // Deletion order: children first, then parents (respect FK).
  await prisma.$transaction(async (tx) => {
    await tx.feedback.deleteMany({});
    await tx.invoiceItem.deleteMany({});
    await tx.invoice.deleteMany({});
    await tx.payment.deleteMany({});
    await tx.subscriptionUsage.deleteMany({});
    await tx.orderItem.deleteMany({});
    await tx.order.deleteMany({});
    await tx.subscription.deleteMany({});
  });

  // Customer-only: Address and User (outside same transaction to keep logic clear; FK safe)
  await prisma.address.deleteMany({ where: { user: { role: Role.CUSTOMER } } });
  await prisma.user.deleteMany({ where: { role: Role.CUSTOMER } });

  const afterCounts = await getCounts();
  printCounts('After', afterCounts);

  console.log('\nPurge complete. Admin users and master data retained.');
}

purge()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
