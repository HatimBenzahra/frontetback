import { Module } from '@nestjs/common';
import { TextProcessingService } from './text-processing.service';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [GeminiModule],
  providers: [TextProcessingService],
  exports: [TextProcessingService],
})
export class TextProcessingModule {}