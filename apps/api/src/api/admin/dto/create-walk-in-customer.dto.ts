import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

/** Phone with optional country code (e.g. +919876543210). Customer is identified by country code + 10-digit mobile. */
export class CreateWalkInCustomerDto {
  @IsString()
  @MinLength(10, { message: 'phone must be at least 10 characters (country code + mobile)' })
  @Matches(/^\+?\d+$/, { message: 'phone must be digits only, with optional leading +' })
  phone!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
