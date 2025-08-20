import { AssignmentType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateZoneDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @IsNumber()
  @IsNotEmpty()
  rayonMetres: number;

  @IsString()
  @IsNotEmpty()
  couleur: string;

  @IsEnum(AssignmentType)
  @IsNotEmpty()
  typeAssignation: AssignmentType;

  @IsString()
  @IsOptional()
  equipeId?: string;

  @IsString()
  @IsOptional()
  managerId?: string;

}
