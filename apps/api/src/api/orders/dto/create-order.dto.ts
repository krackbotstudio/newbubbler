import { IsArray, IsEnum, IsIn, IsISO8601, IsNumber, IsOptional, IsString, ArrayMinSize, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType } from '@shared/enums';

export class CreateOrderDto {
  /** Order type: INDIVIDUAL (default). */
  @IsOptional()
  @IsIn(['INDIVIDUAL'])
  orderType?: 'INDIVIDUAL';

  /** Single service (backward compat). Required when services/selectedServices not provided and orderType is INDIVIDUAL. */
  @ValidateIf((o) => !o.services?.length && !o.selectedServices?.length)
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  /** Multi-select services. Required for INDIVIDUAL. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one service is required for individual booking' })
  @IsEnum(ServiceType, { each: true })
  services?: ServiceType[];

  /** Alias for services. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one service is required for individual booking' })
  @IsEnum(ServiceType, { each: true })
  selectedServices?: ServiceType[];

  @IsString()
  addressId!: string;

  @IsISO8601()
  pickupDate!: string;

  @IsString()
  timeWindow!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  estimatedWeightKg?: number;

  /** Individual orders: branch that serves the address pincode (required when multiple branches serve the same pincode). */
  @IsOptional()
  @IsString()
  branchId?: string;
}

