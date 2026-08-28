import { Module } from '@nestjs/common';
import { EngineeringArenaController } from './engineering-arena.controller';
import { ArenaAdminController } from './controllers/arena-admin.controller';
import { ArenaCopilotController } from './controllers/arena-copilot.controller';
import { EngineeringArenaService } from './engineering-arena.service';
import { ArenaAdminService } from './services/arena-admin.service';
import { ArenaEvaluationService } from './services/arena-evaluation.service';
import { ArenaRecommendationService } from './services/arena-recommendation.service';
import { ArenaCopilotService } from './services/arena-copilot.service';
import { ArenaAntiCheatService } from './services/arena-anti-cheat.service';
import { ArenaPatchExporterService } from './services/arena-patch-exporter.service';
import { ArenaReportExporterService } from './services/arena-report-exporter.service';
import { ArenaSseService } from './services/arena-sse.service';
import { DeterministicLocalWorkspaceRuntime } from './runtime/deterministic-local.runtime';
import { DockerSandboxWorkspaceRuntime } from './runtime/docker-sandbox.runtime';
import { ChallengeValidatorService } from './validator/challenge-validator.service';
import { B2bArenaTenantGuard } from './guards/b2b-arena.guard';
import { ArenaChallengeRepository } from './repositories/arena-challenge.repository';
import { ArenaSessionRepository } from './repositories/arena-session.repository';
import { PrismaModule } from '../platform/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    EngineeringArenaController,
    ArenaAdminController,
    ArenaCopilotController,
  ],
  providers: [
    EngineeringArenaService,
    ArenaAdminService,
    ArenaEvaluationService,
    ArenaRecommendationService,
    ArenaCopilotService,
    ArenaAntiCheatService,
    ArenaPatchExporterService,
    ArenaReportExporterService,
    ArenaSseService,
    DeterministicLocalWorkspaceRuntime,
    DockerSandboxWorkspaceRuntime,
    ChallengeValidatorService,
    B2bArenaTenantGuard,
    ArenaChallengeRepository,
    ArenaSessionRepository,
  ],
  exports: [
    EngineeringArenaService,
    ArenaAdminService,
    ArenaEvaluationService,
    ArenaRecommendationService,
    ArenaCopilotService,
    ArenaAntiCheatService,
    ArenaPatchExporterService,
    ArenaReportExporterService,
    ArenaSseService,
    DeterministicLocalWorkspaceRuntime,
    DockerSandboxWorkspaceRuntime,
    ChallengeValidatorService,
    B2bArenaTenantGuard,
    ArenaChallengeRepository,
    ArenaSessionRepository,
  ],
})
export class EngineeringArenaModule {}
