import { Injectable } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';

@Injectable()
export class EvaluationService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvaluationForAnswer(answerId: string) {
    return this.prisma.evaluation.findUnique({
      where: { answerId },
    });
  }
}
