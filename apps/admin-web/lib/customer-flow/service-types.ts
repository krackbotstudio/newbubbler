/** Mirrors `apps/customer-mobile/src/types.ts` — grid excludes ADD_ONS (same as mobile home booking). */
export type CustomerFlowServiceTypeId =
  | 'WASH_FOLD'
  | 'WASH_IRON'
  | 'DRY_CLEAN'
  | 'SHOES'
  | 'STEAM_IRON'
  | 'HOME_LINEN';

export const CUSTOMER_FLOW_SERVICE_TYPES: { id: CustomerFlowServiceTypeId; label: string; iconFile: string }[] = [
  { id: 'WASH_FOLD', label: 'Wash & Fold', iconFile: 'wash-and-fold.png' },
  { id: 'WASH_IRON', label: 'Wash & Iron', iconFile: 'wash-and-iron.png' },
  { id: 'DRY_CLEAN', label: 'Dry cleaning', iconFile: 'dry-cleaning.png' },
  { id: 'SHOES', label: 'Shoe', iconFile: 'shoe-cleaning.png' },
  { id: 'STEAM_IRON', label: 'Steam Iron', iconFile: 'steam-iron.png' },
  { id: 'HOME_LINEN', label: 'Home linen', iconFile: 'home-linen.png' },
];

export function customerFlowServiceIconUrl(iconFile: string): string {
  return `/customer-flow/service-icons/${iconFile}`;
}
