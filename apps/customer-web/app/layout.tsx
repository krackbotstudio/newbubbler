import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import './globals.css';
import { PortalBootstrap } from './PortalBootstrap';

export const metadata: Metadata = {
  title: 'Laundry Customer',
  description: 'Customer app for Laundry platform',
};

export const viewport: Viewport = {
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <PortalBootstrap />
          {children}
        </Providers>
      </body>
    </html>
  );
}
