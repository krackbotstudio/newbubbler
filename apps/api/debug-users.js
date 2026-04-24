const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const counts = await prisma.user.groupBy({
      by: ['role'],
      _count: {
        _all: true
      }
    });
    console.log('Role Counts:', JSON.stringify(counts, null, 2));

    const admins = await prisma.user.findMany({
      where: { role: { not: 'CUSTOMER' } },
      select: { email: true, role: true, name: true, branchId: true }
    });
    console.log('Non-Customer Users:', JSON.stringify(admins, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
