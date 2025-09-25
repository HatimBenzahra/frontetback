import { Module } from "@nestjs/common";
import { DirecteurPorteController } from "./directeur-porte.controller";
import { DirecteurSpaceService } from "../directeur-space.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { AssignmentGoalsModule } from "../../assignment-goals/assignment-goals.module";

@Module({
  imports: [PrismaModule, AssignmentGoalsModule],
  controllers: [DirecteurPorteController],
  providers: [DirecteurSpaceService],
})
export class DirecteurPorteModule {}
