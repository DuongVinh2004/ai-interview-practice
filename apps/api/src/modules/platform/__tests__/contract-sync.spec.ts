import * as fs from 'fs';
import * as path from 'path';
import {
  SessionState,
  UserRole,
  UserStatus,
  QuestionPublicationStatus,
  SubscriptionStatus,
  InvoiceStatus,
  SessionMode,
  CompetencyArea,
  BillingMetric,
  CreateInterviewDtoSchema,
  SubmitAnswerDtoSchema,
} from '@ai-interview/contracts';

describe('Contract & Schema Synchronization Verification (L1)', () => {
  const schemaPath = path.resolve(__dirname, '../../../../prisma/schema.prisma');
  let schemaContent: string;

  beforeAll(() => {
    schemaContent = fs.readFileSync(schemaPath, 'utf8');
  });

  function parsePrismaEnum(enumName: string): string[] {
    const regex = new RegExp('enum\\s+' + enumName + '\\s+\\{([\\s\\S]*?)\\}', 'm');
    const match = schemaContent.match(regex);
    if (!match) {
      throw new Error('Enum ' + enumName + ' not found in schema.prisma');
    }
    return match[1]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('//'));
  }

  function parsePrismaModelFields(
    modelName: string,
  ): Map<string, { type: string; isOptional: boolean }> {
    const regex = new RegExp('model\\s+' + modelName + '\\s+\\{([\\s\\S]*?)\\}', 'm');
    const match = schemaContent.match(regex);
    if (!match) {
      throw new Error('Model ' + modelName + ' not found in schema.prisma');
    }
    const fields = new Map<string, { type: string; isOptional: boolean }>();
    const lines = match[1].split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const fieldName = parts[0];
        const fieldType = parts[1];
        fields.set(fieldName, {
          type: fieldType.replace('?', ''),
          isOptional: fieldType.endsWith('?'),
        });
      }
    }
    return fields;
  }

  describe('Enum Synchronizations', () => {
    it('SessionState enum in contracts matches Prisma schema exactly', () => {
      const prismaValues = parsePrismaEnum('SessionState');
      const contractValues = Object.values(SessionState);

      expect(contractValues.sort()).toEqual(prismaValues.sort());
      expect(prismaValues).toContain('CREATED');
      expect(prismaValues).toContain('ACTIVE');
      expect(prismaValues).toContain('EVALUATING');
      expect(prismaValues).toContain('COMPLETED');
      expect(prismaValues).toContain('CANCELLED');
      expect(prismaValues).toContain('FAILED');
    });

    it('UserRole enum in contracts matches Prisma schema exactly', () => {
      const prismaValues = parsePrismaEnum('UserRole');
      const contractValues = Object.values(UserRole);

      expect(contractValues.sort()).toEqual(prismaValues.sort());
      expect(prismaValues.sort()).toEqual(['ADMIN', 'CANDIDATE'].sort());
    });

    it('UserStatus enum in contracts matches Prisma schema exactly', () => {
      const prismaValues = parsePrismaEnum('UserStatus');
      const contractValues = Object.values(UserStatus);

      expect(contractValues.sort()).toEqual(prismaValues.sort());
      expect(prismaValues.sort()).toEqual(['ACTIVE', 'LOCKED'].sort());
    });

    it('QuestionPublicationStatus enum in contracts matches Prisma schema exactly', () => {
      const prismaValues = parsePrismaEnum('QuestionPublicationStatus');
      const contractValues = Object.values(QuestionPublicationStatus);

      expect(contractValues.sort()).toEqual(prismaValues.sort());
      expect(prismaValues.sort()).toEqual(
        ['APPROVED', 'ARCHIVED', 'DRAFT', 'IN_REVIEW', 'PUBLISHED'].sort(),
      );
    });

    it('SubscriptionStatus enum in contracts matches Prisma schema exactly', () => {
      const prismaValues = parsePrismaEnum('SubscriptionStatus');
      const contractValues = Object.values(SubscriptionStatus);

      expect(contractValues.sort()).toEqual(prismaValues.sort());
      expect(prismaValues.sort()).toEqual(
        ['ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING', 'UNPAID'].sort(),
      );
    });

    it('InvoiceStatus enum in contracts matches Prisma schema exactly', () => {
      const prismaValues = parsePrismaEnum('InvoiceStatus');
      const contractValues = Object.values(InvoiceStatus);

      expect(contractValues.sort()).toEqual(prismaValues.sort());
      expect(prismaValues.sort()).toEqual(
        ['DRAFT', 'OPEN', 'PAID', 'UNCOLLECTIBLE', 'VOID'].sort(),
      );
    });

    it('SessionMode enum in contracts matches Prisma schema exactly', () => {
      const prismaValues = parsePrismaEnum('SessionMode');
      const contractValues = Object.values(SessionMode);

      expect(contractValues.sort()).toEqual(prismaValues.sort());
      expect(prismaValues).toContain('STANDARD');
      expect(prismaValues).toContain('CODING');
      expect(prismaValues).toContain('SYSTEM_DESIGN');
    });

    it('CompetencyArea enum in contracts matches Prisma schema exactly', () => {
      const prismaValues = parsePrismaEnum('CompetencyArea');
      const contractValues = Object.values(CompetencyArea);

      expect(contractValues.sort()).toEqual(prismaValues.sort());
    });
  });

  describe('Model Schema Constraints & Field Alignment', () => {
    it('InterviewSession model has all required fields aligned with domain expectations', () => {
      const fields = parsePrismaModelFields('InterviewSession');

      expect(fields.has('id')).toBe(true);
      expect(fields.get('id')?.isOptional).toBe(false);

      expect(fields.has('userId')).toBe(true);
      expect(fields.get('userId')?.isOptional).toBe(false);

      expect(fields.has('jobRoleId')).toBe(true);
      expect(fields.get('jobRoleId')?.isOptional).toBe(false);

      expect(fields.has('seniorityLevelId')).toBe(true);
      expect(fields.get('seniorityLevelId')?.isOptional).toBe(false);

      expect(fields.has('state')).toBe(true);
      expect(fields.get('state')?.isOptional).toBe(false);

      expect(fields.has('currentTurn')).toBe(true);
      expect(fields.has('totalTurns')).toBe(true);
      expect(fields.has('overallScore')).toBe(true);
      expect(fields.get('overallScore')?.isOptional).toBe(true);
    });

    it('QuestionAnswerAccessGrant model enforces composite uniqueness and policyVersion', () => {
      const fields = parsePrismaModelFields('QuestionAnswerAccessGrant');

      expect(fields.has('id')).toBe(true);
      expect(fields.has('userId')).toBe(true);
      expect(fields.has('questionId')).toBe(true);
      expect(fields.has('answerId')).toBe(true);
      expect(fields.has('accessPeriodKey')).toBe(true);
      expect(fields.has('idempotencyKey')).toBe(true);
      expect(fields.has('policyVersion')).toBe(true);

      expect(schemaContent).toContain('@@unique([userId, questionId, answerId, accessPeriodKey])');
      expect(schemaContent).toContain('@@unique([userId, idempotencyKey])');
    });

    it('QuestionBankUsageLedger model enforces one ledger per grant', () => {
      const fields = parsePrismaModelFields('QuestionBankUsageLedger');

      expect(fields.has('id')).toBe(true);
      expect(fields.has('userId')).toBe(true);
      expect(fields.has('grantId')).toBe(true);
      expect(fields.get('grantId')?.isOptional).toBe(false);
      expect(fields.has('quantity')).toBe(true);
      expect(fields.get('quantity')?.isOptional).toBe(false);

      expect(schemaContent).toMatch(/grantId\s+String\s+@unique/);
    });

    it('EntitlementReservation model enforces idempotency and bucket relations', () => {
      const fields = parsePrismaModelFields('EntitlementReservation');

      expect(fields.has('id')).toBe(true);
      expect(fields.has('bucketId')).toBe(true);
      expect(fields.has('userId')).toBe(true);
      expect(fields.has('metric')).toBe(true);
      expect(fields.has('accessPeriodKey')).toBe(true);
      expect(fields.has('idempotencyKey')).toBe(true);
      expect(fields.has('state')).toBe(true);

      expect(schemaContent).toContain(
        '@@unique([userId, metric, accessPeriodKey, idempotencyKey])',
      );
    });
  });

  describe('Zod Schema vs NestJS DTO Contract Synchronization', () => {
    it('CreateInterviewDtoSchema validates valid DTO payloads', () => {
      const validPayload = {
        jobRoleId: '11111111-1111-4111-8111-111111111111',
        seniorityLevelId: '22222222-2222-4222-8222-222222222222',
        technologyIds: ['33333333-3333-4333-8333-333333333333'],
        sessionMode: SessionMode.STANDARD,
        language: 'vi',
        totalTurns: 5,
      };

      const parsed = CreateInterviewDtoSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);

      const invalidPayload = {
        jobRoleId: 'not-a-uuid',
        seniorityLevelId: '22222222-2222-4222-8222-222222222222',
        technologyIds: [],
      };
      const invalidParsed = CreateInterviewDtoSchema.safeParse(invalidPayload);
      expect(invalidParsed.success).toBe(false);
    });

    it('SubmitAnswerDtoSchema validates valid answer submissions', () => {
      const validPayload = {
        turnId: '44444444-4444-4444-8444-444444444444',
        answerText: 'In a microservice architecture, we use circuit breakers...',
      };

      const parsed = SubmitAnswerDtoSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);

      const emptyPayload = {
        turnId: '44444444-4444-4444-8444-444444444444',
        answerText: '   ',
      };
      const emptyParsed = SubmitAnswerDtoSchema.safeParse(emptyPayload);
      expect(emptyParsed.success).toBe(false);
    });
  });
});
