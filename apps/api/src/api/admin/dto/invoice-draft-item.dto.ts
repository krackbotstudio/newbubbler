import { IsEnum, IsString, IsInt, IsNumber, Min, IsOptional } from 'class-validator';
import { InvoiceItemType } from '@shared/enums';
import { Type } from 'class-transformer';

export class InvoiceDraftItemDto {
  @IsEnum(InvoiceItemType)
  type!: InvoiceItemType;

  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  quantity!: number;

  /** Optional piece count; omit to mean “same as quantity” on the client. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  clothesCount?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitPricePaise!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amountPaise?: number;

  @IsOptional()
  @IsString()
  catalogItemId?: string | null;

  @IsOptional()
  @IsString()
  segmentCategoryId?: string | null;

  @IsOptional()
  @IsString()
  serviceCategoryId?: string | null;
}
