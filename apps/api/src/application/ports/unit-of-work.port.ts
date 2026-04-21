import type { OrdersRepo } from './orders-repo.port';
import type { InvoicesRepo } from './invoices-repo.port';
import type { PaymentsRepo } from './payments-repo.port';

/**
 * Repos scoped to a single transaction. Use for atomic operations:
 * create order + usage + decrement; issue invoice; payment update + order.paymentStatus.
 */
export interface TransactionRepos {
  ordersRepo: OrdersRepo;
  invoicesRepo: InvoicesRepo;
  paymentsRepo: PaymentsRepo;
}

export interface UnitOfWork {
  runInTransaction<T>(fn: (repos: TransactionRepos) => Promise<T>): Promise<T>;
}
