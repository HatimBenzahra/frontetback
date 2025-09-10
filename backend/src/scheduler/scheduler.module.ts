import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { Reflector } from '@nestjs/core';

@Module({
  imports: [
    ScheduleModule.forRoot(),
  ],
  providers: [Reflector],
  exports: [Reflector],
})
export class SchedulerModule {}
