import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

function trimEmptyToUndefined({ value }: { value: unknown }): unknown {
  if (value == null) return undefined;
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? undefined : t;
}

export class AdminSignupCompleteDto {
  /** Must match the email on the Supabase session (sanity check). */
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  branchName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  branchAddress!: string;

  /** Branch contact number (required); digits-only length validated in service (10–15). */
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  branchPhone!: string;

  /** Public branch contact email (stored on Branch.email), not the login email. */
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsEmail()
  @MaxLength(254)
  branchContactEmail?: string;

  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  @MaxLength(32)
  gstNumber?: string;

  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  @MaxLength(20)
  panNumber?: string;

  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  @MaxLength(500)
  footerNote?: string;

  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  @MaxLength(120)
  upiId?: string;

  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  @MaxLength(120)
  upiPayeeName?: string;

  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  @MaxLength(500)
  upiLink?: string;
}
