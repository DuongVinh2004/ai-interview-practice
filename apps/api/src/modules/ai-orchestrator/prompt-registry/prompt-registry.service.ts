import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../platform/prisma/prisma.service';

@Injectable()
export class PromptRegistryService {
  private readonly logger = new Logger(PromptRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getActivePrompt(slug: string) {
    const prompt = await this.prisma.promptVersion.findFirst({
      where: { slug, isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!prompt) {
      this.logger.warn(`No active prompt found in DB for slug: ${slug}, using default fallback.`);
      return {
        id: undefined,
        slug,
        version: 1,
        systemPrompt: 'You are an expert IT interviewer.',
        userPromptTemplate: 'Generate question or evaluation.',
      };
    }

    return prompt;
  }
}
