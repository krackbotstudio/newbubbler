import { IsEmail } from 'class-validator';

export class DevSignupSessionDto {
  @IsEmail()
  email!: string;
}
