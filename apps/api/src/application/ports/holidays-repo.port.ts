export interface HolidayRecord {
  id: string;
  date: Date;
  label: string | null;
  branchId: string | null; // null = common holiday for all branches
}

export interface UpdateHolidayPatch {
  date?: Date;
  label?: string | null;
  branchId?: string | null;
}

export interface HolidaysRepo {
  /** Check if date is a holiday (common or for this branch). */
  isHoliday(date: Date, branchId?: string | null): Promise<boolean>;
  /** List holidays in range. When branchId provided: common + that branch's holidays. */
  list(from: Date, to: Date, branchId?: string | null): Promise<HolidayRecord[]>;
  getById(id: string): Promise<HolidayRecord | null>;
  add(date: Date, label?: string | null, branchId?: string | null): Promise<HolidayRecord>;
  update(id: string, patch: UpdateHolidayPatch): Promise<HolidayRecord>;
  remove(id: string): Promise<void>;
}
