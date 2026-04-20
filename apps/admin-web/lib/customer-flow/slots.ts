import { getBaseURL } from '@/lib/api';

export interface SlotAvailability {
  isServiceable: boolean;
  isHoliday: boolean;
  branchName?: string;
  operatingHours?: { startTime: string; endTime: string };
  timeSlots: string[];
  message?: string;
}

export async function fetchSlotAvailability(
  pincode: string,
  date: string,
  branchId?: string | null,
): Promise<SlotAvailability> {
  const base = getBaseURL().replace(/\/$/, '');
  const q = new URLSearchParams({ pincode: pincode.trim(), date: date.trim() });
  if (branchId?.trim()) q.set('branchId', branchId.trim());
  const res = await fetch(`${base}/slots/availability?${q.toString()}`);
  if (!res.ok) {
    return { isServiceable: false, isHoliday: false, timeSlots: [] };
  }
  return (await res.json()) as SlotAvailability;
}

/** Local calendar YYYY-MM-DD (avoids UTC off-by-one vs `toISOString().slice(0,10)`). */
export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function filterPastSlotsToday(slots: string[], dateKey: string, todayKey: string): string[] {
  if (dateKey !== todayKey) return slots;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  return slots.filter((slot) => {
    const start = slot.split('-')[0]?.trim() ?? '';
    const [h, m] = start.split(':').map(Number);
    if (Number.isNaN(h)) return true;
    return h * 60 + (m || 0) > mins;
  });
}
