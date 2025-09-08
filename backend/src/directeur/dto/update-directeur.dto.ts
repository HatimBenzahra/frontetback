import { PartialType } from '@nestjs/mapped-types';
import { CreateDirecteurDto } from './create-directeur.dto';

export class UpdateDirecteurDto extends PartialType(CreateDirecteurDto) {}