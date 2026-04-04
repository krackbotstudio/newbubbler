'use client';

import {
  Shirt,
  User,
  CircleUserRound,
  Baby,
  WashingMachine,
  Wind,
  PlusCircle,
  type LucideIcon,
} from 'lucide-react';
import { getApiOrigin } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Map stored preset icon value (e.g. from API) to Lucide icon. */
export const ICON_MAP: Record<string, LucideIcon> = {
  'tshirt-crew': Shirt,
  'human-male': User,
  'human-female': CircleUserRound,
  hoodie: Shirt,
  'coat-rack': Shirt,
  'human-child': Baby,
  'washing-machine': WashingMachine,
  'tumble-dryer': Wind,
  'plus-circle': PlusCircle,
};

const DEFAULT_ICON = Shirt;

/** True if icon is a preset key (not a custom URL). */
export function isPresetIcon(icon: string | null | undefined): boolean {
  if (!icon) return false;
  return icon in ICON_MAP && !icon.startsWith('/') && !icon.startsWith('http');
}

interface CatalogItemIconProps {
  /** Icon: preset key (e.g. "tshirt-crew") or custom image URL. */
  icon?: string | null;
  size?: number;
  className?: string;
  /** Optional cache-buster appended as query param for URL icons. */
  cacheBuster?: string | null;
}

export function CatalogItemIcon({ icon, size = 22, className, cacheBuster }: CatalogItemIconProps) {
  if (!icon) {
    const IconComponent = DEFAULT_ICON;
    return <IconComponent size={size} className={cn('block', className)} aria-hidden />;
  }
  if (icon.startsWith('/') || icon.startsWith('http')) {
    const baseSrc = icon.startsWith('http') ? icon : `${getApiOrigin()}${icon}`;
    const src = cacheBuster
      ? `${baseSrc}${baseSrc.includes('?') ? '&' : '?'}v=${encodeURIComponent(cacheBuster)}`
      : baseSrc;
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={cn('inline-block align-middle shrink-0', className)}
        style={{ width: size, height: size, objectFit: 'contain', verticalAlign: 'middle', display: 'inline-block' }}
      />
    );
  }
  const IconComponent = ICON_MAP[icon] ?? DEFAULT_ICON;
  return (
    <IconComponent size={size} className={cn('shrink-0 block align-middle', className)} aria-hidden />
  );
}
