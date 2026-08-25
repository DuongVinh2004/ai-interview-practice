import { Injectable, Logger } from '@nestjs/common';
import { MultimodalProvider, MultimodalAnalysisOptions } from './multimodal-provider.interface';
import { VisionAnalysisResultDto } from '@ai-interview/contracts';

@Injectable()
export class MockVisionProvider implements MultimodalProvider {
  private readonly logger = new Logger(MockVisionProvider.name);

  async analyzeCanvasDiagram(options: MultimodalAnalysisOptions): Promise<VisionAnalysisResultDto> {
    this.logger.log(
      `MockVisionProvider analyzing canvas snapshot (Length: ${options.imageUrl?.length || 0})`,
    );

    // Detect components from canvas state if present, else standard detected architecture
    const stateElements = options.canvasStateJson?.elements || [];
    const detected: string[] = [
      'Load Balancer',
      'API Gateway',
      'Microservices',
      'Distributed Cache',
    ];

    if (stateElements.length > 0) {
      for (const el of stateElements) {
        if (el.type && !detected.includes(el.type)) {
          detected.push(el.type);
        }
      }
    }

    if (!detected.includes('PostgreSQL DB')) detected.push('PostgreSQL DB');
    if (!detected.includes('Kafka Queue')) detected.push('Kafka Queue');

    return {
      summary:
        'The candidate designed a multi-tier microservices architecture with an API Gateway, distributed Redis caching layer, and asynchronous message queue for high write throughput.',
      detectedComponents: detected,
      architectureStyle: 'Event-Driven Microservices',
      strengths: [
        'Clear separation of read and write paths with Redis caching',
        'Decoupled asynchronous processing via message broker queue',
        'Load balanced ingress layer preventing single points of failure',
      ],
      potentialBottlenecks: [
        'Consider database replication lag when reading right after write',
        'Specify cache eviction strategy (e.g. LRU with TTL)',
        'Add circuit breakers between gateway and downstream services',
      ],
      realtimeSuggestions: [
        'What happens if the primary database crashes during peak traffic?',
        'How would you shard the database if data exceeds 50TB?',
      ],
      rubricScores: {
        requirements: 8.5,
        highLevel: 8.5,
        componentDetail: 8.0,
        scalability: 8.5,
        dataModel: 8.0,
      },
    };
  }
}
