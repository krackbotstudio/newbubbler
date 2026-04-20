import { IsString, IsOptional, IsBoolean, MaxLength, Matches } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  name!: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  gstNumber?: string | null;

  @IsOptional()
  @IsString()
  panNumber?: string | null;

  @IsOptional()
  @IsString()
  footerNote?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  invoicePrefix?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  itemTagBrandName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200000)
  termsAndConditions?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  @Matches(/^#?[0-9A-Fa-f]{6}$/)
  primaryColor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  @Matches(/^#?[0-9A-Fa-f]{6}$/)
  secondaryColor?: string | null;

  @IsOptional()
  @IsString()
  upiId?: string | null;

  @IsOptional()
  @IsString()
  upiPayeeName?: string | null;

  @IsOptional()
  @IsString()
  upiLink?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
