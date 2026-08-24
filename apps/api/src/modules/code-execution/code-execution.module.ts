import { Module } from '@nestjs/common';
import { CodeExecutionService } from './code-execution.service';
import { CodeExecutionController } from './code-execution.controller';
import { MockSandboxProvider } from './providers/mock-sandbox.provider';
import { Judge0Provider } from './providers/judge0.provider';

@Module({
  controllers: [CodeExecutionController],
  providers: [CodeExecutionService, MockSandboxProvider, Judge0Provider],
  exports: [CodeExecutionService, MockSandboxProvider, Judge0Provider],
})
export class CodeExecutionModule {}
