import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class ServiceabilityQueryDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
  pincode!: string;

  /** When set, only this branch’s active service pincodes count as serviceable (customer portal). */
  @IsOptional()
  @IsUUID(undefined, { message: 'branchId must be a UUID when provided' })
  branchId?: string;
}
