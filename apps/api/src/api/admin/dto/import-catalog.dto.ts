import { IsOptional, IsString } from 'class-validator';

export class ImportCatalogDto {
  @IsString()
  content!: string;

  /** Required for ADMIN: branch whose segment/service taxonomy is created or updated. OPS uses assigned branch. */
  @IsOptional()
  @IsString()
  branchId?: string;
}
