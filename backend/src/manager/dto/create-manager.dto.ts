import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateManagerDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsNotEmpty()
  prenom: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  telephone?: string;
}
