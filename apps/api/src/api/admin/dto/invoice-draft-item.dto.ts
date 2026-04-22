import { IsEnum, IsString, IsInt, IsNumber, Min, IsOptional, MaxLength } from 'class-validator';
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

  /** Optional piece count (legacy); omit to mean “same as quantity” on the client. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  clothesCount?: number;

  /** Per-line remarks (shown on invoice / PDF). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string | null;

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
