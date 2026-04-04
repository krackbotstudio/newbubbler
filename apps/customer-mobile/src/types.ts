export type ServiceTypeId =
  | 'WASH_FOLD'
  | 'WASH_IRON'
  | 'DRY_CLEAN'
  | 'SHOES'
  | 'STEAM_IRON'
  | 'HOME_LINEN';

export interface CustomerAddress {
  id: string;
  user_id: string;
  label: string;
  address_line: string;
  pincode: string;
  google_place_url: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const SERVICE_TYPES: { id: ServiceTypeId; label: string; icon: string }[] = [
  { id: 'WASH_FOLD', label: 'Wash & Fold', icon: '🧺' },
  { id: 'WASH_IRON', label: 'Wash & Iron', icon: '👔' },
  { id: 'DRY_CLEAN', label: 'Dry cleaning', icon: '🧥' },
  { id: 'SHOES', label: 'Shoe', icon: '👟' },
  { id: 'STEAM_IRON', label: 'Steam Iron', icon: '♨️' },
  { id: 'HOME_LINEN', label: 'Home linen', icon: '🛏️' },
];
