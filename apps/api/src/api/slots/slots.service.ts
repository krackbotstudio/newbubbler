import { Inject, Injectable } from '@nestjs/common';
import type { ServiceAreaRepo, HolidaysRepo, OperatingHoursRepo, BranchRepo } from '../../application/ports';
import { SERVICE_AREA_REPO, HOLIDAYS_REPO, OPERATING_HOURS_REPO, BRANCH_REPO } from '../../infra/infra.module';

/** Generate 2-hour time slots between start and end (HH:MM format). Last slot may be shorter. */
function generateTimeSlots(startTime: string, endTime: string): string[] {
  const [sh, sm] = startTime.split(':').map((x) => parseInt(x, 10));
  const [eh, em] = endTime.split(':').map((x) => parseInt(x, 10));
  const startMins = sh * 60 + (sm || 0);
  const endMins = eh * 60 + (em || 0);
  const slots: string[] = [];
  const slotMinutes = 120; // 2 hours
  for (let m = startMins; m < endMins; m += slotMinutes) {
    const end = Math.min(m + slotMinutes, endMins);
    const h1 = Math.floor(m / 60);
    const m1 = m % 60;
    const h2 = Math.floor(end / 60);
    const m2 = end % 60;
    const s = `${h1.toString().padStart(2, '0')}:${m1.toString().padStart(2, '0')}-${h2.toString().padStart(2, '0')}:${m2.toString().padStart(2, '0')}`;
    slots.push(s);
  }
  return slots;
}

@Injectable()
export class SlotsService {
  constructor(
    @Inject(SERVICE_AREA_REPO) private readonly serviceAreaRepo: ServiceAreaRepo,
    @Inject(HOLIDAYS_REPO) private readonly holidaysRepo: HolidaysRepo,
    @Inject(OPERATING_HOURS_REPO) private readonly operatingHoursRepo: OperatingHoursRepo,
    @Inject(BRANCH_REPO) private readonly branchRepo: BranchRepo,
  ) {}

  async getAvailability(pincode: string, date: string, preferredBranchId?: string): Promise<{
    isServiceable: boolean;
    isHoliday: boolean;
    branchName?: string;
    operatingHours?: { startTime: string; endTime: string };
    timeSlots: string[];
  }> {
    const isServiceable = await this.serviceAreaRepo.isServiceable(pincode);
    if (!isServiceable) {
      return { isServiceable: false, isHoliday: false, timeSlots: [] };
    }
    let branchId: string | null = null;
    if (preferredBranchId) {
      const areas = await this.serviceAreaRepo.listActiveByPincode(pincode);
      const match = areas.find((a) => a.branchId === preferredBranchId);
      branchId = match?.branchId ?? null;
      if (!branchId) {
        return { isServiceable: false, isHoliday: false, timeSlots: [] };
      }
    } else {
      const area = await this.serviceAreaRepo.getByPincode(pincode);
      branchId = area?.branchId ?? null;
    }
    const branch = branchId ? await this.branchRepo.getById(branchId) : null;
    const branchName = branch?.name;

    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      return { isServiceable: true, isHoliday: false, branchName, timeSlots: [] };
    }
    const isHoliday = await this.holidaysRepo.isHoliday(d, branchId ?? undefined);
    if (isHoliday) {
      return { isServiceable: true, isHoliday: true, branchName, timeSlots: [] };
    }

    const hours = await this.operatingHoursRepo.get(branchId ?? undefined);
    if (!hours) {
      return { isServiceable: true, isHoliday: false, branchName, timeSlots: [] };
    }
    const timeSlots = generateTimeSlots(hours.startTime, hours.endTime);
    return {
      isServiceable: true,
      isHoliday: false,
      branchName,
      operatingHours: { startTime: hours.startTime, endTime: hours.endTime },
      timeSlots,
    };
  }
}
