'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck2, ClipboardList, Home, ListOrdered, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomerBottomNavProps {
  branchSlug: string;
}

export function CustomerBottomNav({ branchSlug }: CustomerBottomNavProps) {
  const pathname = usePathname();
  const base = `/customer/${branchSlug}`;
  const items = [
    { href: `${base}/home`, label: 'Home', icon: Home },
    { href: `${base}/price-list`, label: 'Price list', icon: ListOrdered },
    { href: `${base}/create-order`, label: 'Book Now', icon: CalendarCheck2, floating: true },
    { href: `${base}/orders`, label: 'Orders', icon: ClipboardList },
    { href: `${base}/profile`, label: 'Profile', icon: UserRound },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-3 z-40 px-4">
      <ul
        className="mx-auto flex h-20 max-w-md items-end justify-between rounded-[30px] px-3 pb-3 pt-2 shadow-2xl"
        style={{ backgroundColor: 'var(--customer-primary, #8a1459)' }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href.endsWith('/home') && pathname === base);
          if (item.floating) {
            return (
              <li key={item.href} className="relative -mt-10">
                <Link href={item.href} className="flex flex-col items-center">
                  <span
                    className="flex h-16 w-16 items-center justify-center rounded-full border-4 shadow-xl"
                    style={{
                      backgroundColor: 'var(--customer-primary, #8a1459)',
                      borderColor: '#ffffff',
                    }}
                  >
                    <Icon className="h-7 w-7 text-white" />
                  </span>
                  <span className="mt-2 text-sm font-semibold text-white">{item.label}</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-medium transition-colors',
                  active ? 'text-white' : 'text-white/80 hover:text-white',
                )}
                style={active ? { backgroundColor: 'rgba(255,255,255,0.16)' } : undefined}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
