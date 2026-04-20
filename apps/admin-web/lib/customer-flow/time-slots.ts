const SLOT_START_HOUR = 9;
const SLOT_END_HOUR = 18;
const SLOT_INTERVAL_MINUTES = 30;

export interface TimeSlotOption {
  label: string;
  value: string;
}

function formatTimeLabel(hour: number, minute: number): string {
  const isPM = hour >= 12;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = isPM ? 'PM' : 'AM';
  const m = minute === 0 ? '00' : String(minute);
  return `${displayHour}:${m} ${ampm}`;
}

function toHHMM(hour: number, minute: number): string {
  const h = String(hour).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `${h}:${m}`;
}

export function getTimeSlotOptions(): TimeSlotOption[] {
  const options: TimeSlotOption[] = [];
  for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_INTERVAL_MINUTES) {
      const start = toHHMM(hour, minute);
      const nextMin = minute + SLOT_INTERVAL_MINUTES;
      const nextHour = nextMin === 60 ? hour + 1 : hour;
      const nextMinAdj = nextMin === 60 ? 0 : nextMin;
      const end = toHHMM(nextHour, nextMinAdj);
      if (nextHour > SLOT_END_HOUR || (nextHour === SLOT_END_HOUR && nextMinAdj > 0)) break;
      options.push({
        label: formatTimeLabel(hour, minute),
        value: `${start}-${end}`,
      });
    }
  }
  return options;
}

export const TIME_SLOT_OPTIONS = getTimeSlotOptions();
export const DEFAULT_TIME_SLOT = TIME_SLOT_OPTIONS[0]!.value;
