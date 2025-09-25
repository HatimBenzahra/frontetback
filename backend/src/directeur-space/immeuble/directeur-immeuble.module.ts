import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AssignmentGoalsModule } from "../../assignment-goals/assignment-goals.module";
import { DirecteurSpaceService } from "../directeur-space.service";
import { DirecteurImmeubleController } from "./directeur-immeuble.controller";

@Module({
  imports: [PrismaModule, AssignmentGoalsModule],
  controllers: [DirecteurImmeubleController],
  providers: [DirecteurSpaceService],
})
export class DirecteurImmeubleModule {}
