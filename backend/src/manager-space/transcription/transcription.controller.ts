import {
  Controller,
  Get,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { TranscriptionService } from './transcription.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

interface AuthRequest extends Request {
  user: {
    managerId: string;
    userId: string;
    roles: string[];
    email: string;
    preferredUsername: string;
  };
}

@Controller('manager-space')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('manager')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}



  @Get('transcriptions')
  async getTranscriptions(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.transcriptionService.getManagerTranscriptions(managerId);
  }

  @Get('transcriptions/commercial/:commercialId')
  async getCommercialTranscriptions(
    @Request() req: AuthRequest,
    @Param('commercialId') commercialId: string
  ) {
    const managerId = req.user.managerId;
    return this.transcriptionService.getCommercialTranscriptions(managerId, commercialId);
  }

  @Get('suivi')
  async getSuiviProspection(
    @Request() req: AuthRequest
  ) {
    const managerId = req.user.managerId;
    return this.transcriptionService.getManagerHistoriques(managerId);
  }
}