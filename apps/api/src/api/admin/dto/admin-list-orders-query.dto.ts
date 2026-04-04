import { IsEnum, IsOptional, IsString, IsInt, Min, Max, Matches, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType, OrderStatus } from '@shared/enums';

export class AdminListOrdersQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode?: string;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  /** Partial match on order id, customer name, or customer phone. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** e.g. WALK_IN to list only walk-in orders. */
  @IsOptional()
  @IsString()
  orderSource?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo?: string;

  /** When set with pickupDateTo, filter by scheduled pickup date only (for dashboard). */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'pickupDateFrom must be YYYY-MM-DD' })
  pickupDateFrom?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'pickupDateTo must be YYYY-MM-DD' })
  pickupDateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  cursor?: string;
}
