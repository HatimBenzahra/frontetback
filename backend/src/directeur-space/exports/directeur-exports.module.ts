import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AssignmentGoalsModule } from "../../assignment-goals/assignment-goals.module";
import { ExportsModule } from "../../exports/exports.module";
import { DirecteurSpaceService } from "../directeur-space.service";
import { DirecteurExportsService } from "./directeur-exports.service";
import { DirecteurExportsController } from "./directeur-exports.controller";

@Module({
  imports: [PrismaModule, AssignmentGoalsModule, ExportsModule],
  controllers: [DirecteurExportsController],
  providers: [DirecteurExportsService, DirecteurSpaceService],
})
export class DirecteurExportsModule {}
