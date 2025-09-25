import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AssignmentGoalsModule } from "../../assignment-goals/assignment-goals.module";
import { DirecteurZoneController } from "./directeur-zone.controller";
import { DirecteurSpaceService } from "../directeur-space.service";

@Module({
  imports: [PrismaModule, AssignmentGoalsModule],
  controllers: [DirecteurZoneController],
  providers: [DirecteurSpaceService],
  exports: [],
})
export class DirecteurZoneModule {}
