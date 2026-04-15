import { IsArray, IsEnum, IsIn, IsISO8601, IsNumber, IsOptional, IsString, ArrayMinSize, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType } from '@shared/enums';

export class CreateOrderDto {
  /** Order type: INDIVIDUAL (default) or SUBSCRIPTION (use existing subscription; purchase first in customer console). */
  @IsOptional()
  @IsIn(['INDIVIDUAL', 'SUBSCRIPTION'])
  orderType?: 'INDIVIDUAL' | 'SUBSCRIPTION';

  /** Single service (backward compat). Required when services/selectedServices not provided and orderType is INDIVIDUAL. */
  @ValidateIf((o) => o.orderType !== 'SUBSCRIPTION' && !o.services?.length && !o.selectedServices?.length)
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  /** Multi-select services. Required for INDIVIDUAL; not used for SUBSCRIPTION. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one service is required for individual booking' })
  @IsEnum(ServiceType, { each: true })
  @ValidateIf((o) => o.orderType !== 'SUBSCRIPTION')
  services?: ServiceType[];

  /** Alias for services. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one service is required for individual booking' })
  @IsEnum(ServiceType, { each: true })
  @ValidateIf((o) => o.orderType !== 'SUBSCRIPTION')
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

  /** Required when orderType is SUBSCRIPTION (use existing subscription). Must be purchased first in customer console. */
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  /** Individual orders: branch that serves the address pincode (required when multiple branches serve the same pincode). */
  @IsOptional()
  @IsString()
  branchId?: string;
}

