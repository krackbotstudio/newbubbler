import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpsertCustomerPortalDto {
  @IsString()
  @MaxLength(60)
  brandName!: string;

  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/, {
    message: 'slug must be lowercase letters/numbers/hyphens and 3-40 chars',
  })
  slug!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  termsAndConditions?: string;
}

