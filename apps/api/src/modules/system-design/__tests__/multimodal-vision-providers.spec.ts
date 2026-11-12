import { ConfigService } from '@nestjs/config';
import { GeminiVisionProvider } from '../providers/gemini-vision.provider';
import { OpenAiVisionProvider } from '../providers/openai-vision.provider';

describe('Multimodal Vision Providers (Sprint 3)', () => {
  describe('GeminiVisionProvider', () => {
    it('throws when API key is not configured', async () => {
      const configService = {
        get: jest.fn().mockReturnValue(''),
      } as unknown as ConfigService;

      const provider = new GeminiVisionProvider(configService);
      await expect(
        provider.evaluateDiagram({
          imageBase64: 'data:image/png;base64,mock',
          language: 'vi',
        }),
      ).rejects.toThrow('Gemini Vision Client is not configured');
    });

    it('parses valid evaluation and strips markdown code fences from response', async () => {
      const mockResultPayload = {
        overallScore: 8.5,
        requirementsScore: 8.0,
        highLevelScore: 9.0,
        componentDetailScore: 8.0,
        scalabilityScore: 8.5,
        dataModelScore: 8.0,
        summary: 'Kiến trúc phân tán tốt',
        feedback: 'Hệ thống thiết kế chịu tải cao',
        detectedComponents: ['API Gateway', 'Redis', 'PostgreSQL'],
        strengths: ['Tách biệt các services rõ ràng'],
        bottlenecks: ['Single database bottleneck'],
        recommendations: ['Thêm database read replica'],
        annotations: [
          {
            x: 10,
            y: 20,
            width: 15,
            height: 15,
            label: 'Cache Layer',
            severity: 'good',
            suggestion: 'Tốt',
          },
        ],
      };

      const mockGenerateContent = jest.fn().mockResolvedValue({
        response: {
          text: () => `\`\`\`json\n${JSON.stringify(mockResultPayload)}\n\`\`\``,
          usageMetadata: { totalTokenCount: 1250 },
        },
      });

      const configService = {
        get: jest.fn((key: string) => {
          if (key === 'vision.geminiApiKey') return 'valid-gemini-key';
          if (key === 'vision.geminiVisionModel') return 'gemini-2.0-flash';
          return undefined;
        }),
      } as unknown as ConfigService;

      const provider = new GeminiVisionProvider(configService);
      // Inject mock client model
      (provider as any).client = {
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: mockGenerateContent,
        }),
      };

      const result = await provider.evaluateDiagram({
        imageBase64: 'data:image/png;base64,mockImage',
        problemTitle: 'Design Distributed Cache',
        requirements: ['Low latency', 'High availability'],
        language: 'vi',
      });

      expect(result.overallScore).toBe(8.5);
      expect(result.summary).toBe('Kiến trúc phân tán tốt');
      expect(result.usageTokens).toBe(1250);
      expect(result.detectedComponents).toContain('Redis');
      expect(result.annotations).toHaveLength(1);
    });
  });

  describe('OpenAiVisionProvider', () => {
    it('throws when API key is not configured', async () => {
      const configService = {
        get: jest.fn().mockReturnValue(''),
      } as unknown as ConfigService;

      const provider = new OpenAiVisionProvider(configService);
      await expect(
        provider.evaluateDiagram({
          imageBase64: 'data:image/png;base64,mock',
          language: 'en',
        }),
      ).rejects.toThrow('OpenAI Vision Client is not configured');
    });

    it('parses valid evaluation and supports baseURL configuration (e.g. 9Router)', async () => {
      const mockResultPayload = {
        overallScore: 9.0,
        requirementsScore: 9.0,
        highLevelScore: 9.0,
        componentDetailScore: 9.0,
        scalabilityScore: 9.0,
        dataModelScore: 9.0,
        summary: 'Excellent scalable design',
        feedback: 'Clear separation of concerns',
        detectedComponents: ['Kafka', 'K8s'],
        strengths: ['Event-driven architecture'],
        bottlenecks: ['None critical'],
        recommendations: ['Add circuit breaker'],
        annotations: [],
      };

      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: `\`\`\`json\n${JSON.stringify(mockResultPayload)}\n\`\`\``,
            },
          },
        ],
        usage: { total_tokens: 850 },
      });

      const configService = {
        get: jest.fn((key: string) => {
          if (key === 'vision.openaiApiKey') return 'sk-valid-key';
          if (key === 'vision.openaiBaseUrl') return 'http://localhost:20128/v1';
          if (key === 'vision.openaiVisionModel') return 'gpt-4o';
          return undefined;
        }),
      } as unknown as ConfigService;

      const provider = new OpenAiVisionProvider(configService);
      (provider as any).client = {
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      };

      const result = await provider.evaluateDiagram({
        imageBase64: 'data:image/png;base64,mockImage',
        problemTitle: 'Event-driven streaming',
        requirements: ['Real-time processing'],
        language: 'en',
      });

      expect(result.overallScore).toBe(9.0);
      expect(result.usageTokens).toBe(850);
      expect(result.summary).toBe('Excellent scalable design');
    });

    it('evaluates S3 presigned / cloud storage image URL and parses 5-rubric scores with annotations', async () => {
      const mockRubricPayload = {
        overallScore: 8.8,
        requirementsScore: 8.5,
        highLevelScore: 9.0,
        componentDetailScore: 8.5,
        scalabilityScore: 9.2,
        dataModelScore: 8.7,
        summary: 'Solid cloud-native distributed architecture',
        feedback: 'Effective partition key and read-replica distribution',
        detectedComponents: ['CloudFront CDN', 'ALB', 'ECS Fargate', 'DynamoDB', 'ElastiCache'],
        strengths: ['Multi-region disaster recovery', 'Low latency caching layer'],
        bottlenecks: ['Hot partition key potential in DynamoDB'],
        recommendations: ['Introduce write-through caching with Redis'],
        annotations: [
          {
            x: 25,
            y: 40,
            width: 30,
            height: 20,
            label: 'DynamoDB Table',
            severity: 'warning',
            suggestion: 'Add composite partition key to prevent hot shard throttling',
          },
        ],
      };

      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockRubricPayload),
            },
          },
        ],
        usage: { total_tokens: 1120 },
      });

      const configService = {
        get: jest.fn((key: string) => {
          if (key === 'vision.openaiApiKey') return 'sk-valid-key';
          if (key === 'vision.openaiVisionModel') return 'gpt-4o';
          return undefined;
        }),
      } as unknown as ConfigService;

      const provider = new OpenAiVisionProvider(configService);
      (provider as any).client = {
        chat: { completions: { create: mockCreate } },
      };

      const s3Url =
        'https://ai-interview-assets.s3.ap-southeast-1.amazonaws.com/system-design/diagram-123.png';
      const result = await provider.evaluateDiagram({
        imageBase64: s3Url,
        imageUrl: s3Url,
        problemTitle: 'Design High-Throughput E-Commerce API',
        requirements: ['99.99% SLA', 'Under 50ms p95 latency'],
        language: 'vi',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o',
          messages: [
            expect.objectContaining({
              role: 'user',
              content: [
                expect.objectContaining({ type: 'text' }),
                {
                  type: 'image_url',
                  image_url: {
                    url: s3Url,
                    detail: 'high',
                  },
                },
              ],
            }),
          ],
        }),
      );

      expect(result.overallScore).toBe(8.8);
      expect(result.requirementsScore).toBe(8.5);
      expect(result.highLevelScore).toBe(9.0);
      expect(result.componentDetailScore).toBe(8.5);
      expect(result.scalabilityScore).toBe(9.2);
      expect(result.dataModelScore).toBe(8.7);
      expect(result.annotations).toHaveLength(1);
      expect(result.annotations[0].label).toBe('DynamoDB Table');
      expect(result.annotations[0].severity).toBe('warning');
    });

    it('transforms s3:// protocol URI to HTTPS S3 URL before calling OpenAI Vision', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                overallScore: 8.0,
                summary: 'Valid S3 diagram',
                feedback: 'Good architecture',
                detectedComponents: ['API Gateway'],
                strengths: ['Decoupled'],
                bottlenecks: [],
                recommendations: [],
                annotations: [],
              }),
            },
          },
        ],
      });

      const configService = {
        get: jest.fn().mockReturnValue('sk-key'),
      } as unknown as ConfigService;

      const provider = new OpenAiVisionProvider(configService);
      (provider as any).client = {
        chat: { completions: { create: mockCreate } },
      };

      await provider.evaluateDiagram({
        imageBase64: 's3://production-bucket/designs/canvas-99.png',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            expect.objectContaining({
              content: expect.arrayContaining([
                {
                  type: 'image_url',
                  image_url: {
                    url: 'https://production-bucket.s3.amazonaws.com/designs/canvas-99.png',
                    detail: 'high',
                  },
                },
              ]),
            }),
          ],
        }),
      );
    });
  });
});
