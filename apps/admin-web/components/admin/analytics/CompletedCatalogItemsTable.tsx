'use client';

import type { CompletedCatalogItemQuantity } from '@/types';

interface CompletedCatalogItemsTableProps {
  rows: CompletedCatalogItemQuantity[];
  isLoading: boolean;
}

export function CompletedCatalogItemsTable({ rows, isLoading }: CompletedCatalogItemsTableProps) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading completed catalog items…</p>;
  }

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No completed catalog items in the selected date range and branch.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Item</th>
            <th className="px-3 py-2 text-left font-medium">Segment</th>
            <th className="px-3 py-2 text-left font-medium">Service</th>
            <th className="px-3 py-2 text-right font-medium">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.itemName}-${row.segment}-${row.service}`}
              className="border-t"
            >
              <td className="px-3 py-2">{row.itemName}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.segment}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.service}</td>
              <td className="px-3 py-2 text-right font-medium">{row.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
