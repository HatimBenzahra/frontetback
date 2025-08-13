import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommercialDto {
  @IsString()
  @IsOptional()
  id?: string;

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

  @IsString()
  @IsOptional()
  equipeId?: string;

  @IsString()
  @IsOptional()
  managerId?: string;

  @IsOptional()
  isAssigned?: boolean;
}
