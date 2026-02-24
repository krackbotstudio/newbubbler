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

/** Map stored icon value (e.g. from API) to Lucide icon for admin catalog tiles. */
const ICON_MAP: Record<string, LucideIcon> = {
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

interface CatalogItemIconProps {
  /** Icon name stored on the catalog item (e.g. "tshirt-crew"). */
  icon?: string | null;
  size?: number;
  className?: string;
}

export function CatalogItemIcon({ icon, size = 22, className }: CatalogItemIconProps) {
  const IconComponent = icon ? ICON_MAP[icon] ?? DEFAULT_ICON : DEFAULT_ICON;
  return <IconComponent size={size} className={className} />;
}
