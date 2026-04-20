import { IsPhoneNumber, IsString } from 'class-validator';

export class CustomerMobileLoginDto {
  @IsString()
  @IsPhoneNumber('IN')
  phone!: string;
}
