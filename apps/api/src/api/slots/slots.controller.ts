import { Controller, Get, Query } from '@nestjs/common';
import { SlotsService } from './slots.service';

@Controller('slots')
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get('availability')
  async getAvailability(
    @Query('pincode') pincode: string,
    @Query('date') date: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!pincode || !date) {
      return {
        isServiceable: false,
        isHoliday: false,
        timeSlots: [],
        message: 'pincode and date are required',
      };
    }
    return this.slotsService.getAvailability(pincode.trim(), date.trim(), branchId?.trim() || undefined);
  }
}
