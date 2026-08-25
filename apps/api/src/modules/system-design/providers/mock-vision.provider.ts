import { Injectable, Logger } from '@nestjs/common';
import { MultimodalProvider, MultimodalAnalysisOptions } from './multimodal-provider.interface';
import {
  VisionProvider,
  VisionEvaluationOptions,
  VisionEvaluationResult,
} from '../interfaces/vision-provider.interface';
import { VisionAnalysisResultDto } from '@ai-interview/contracts';

@Injectable()
export class MockVisionProvider implements MultimodalProvider, VisionProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockVisionProvider.name);

  async analyzeCanvasDiagram(options: MultimodalAnalysisOptions): Promise<VisionAnalysisResultDto> {
    this.logger.log(
      `MockVisionProvider analyzing canvas snapshot (Length: ${options.imageUrl?.length || 0})`,
    );

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

  async evaluateDiagram(options: VisionEvaluationOptions): Promise<VisionEvaluationResult> {
    this.logger.log(`MockVisionProvider evaluating diagram for problem: ${options.problemTitle || 'System Design'}`);

    const isVi = options.language === 'vi';

    return {
      overallScore: 8.5,
      requirementsScore: 8.5,
      highLevelScore: 9.0,
      componentDetailScore: 8.0,
      scalabilityScore: 8.5,
      dataModelScore: 8.5,
      summary: isVi
        ? 'Kiến trúc phân tán Microservices với phân tách luồng đọc/ghi qua Redis Cache và Kafka Queue được bố trí rất chặt chẽ.'
        : 'Solid distributed microservices architecture with clean read/write segregation via Redis Cache and Kafka Queue.',
      feedback: isVi
        ? 'Sơ đồ hệ thống thể hiện rõ ranh giới API Gateway, cụm dịch vụ nghiệp vụ và tầng lưu trữ phân tán. Cần chú ý thêm cơ chế Circuit Breaker khi Kafka broker gặp sự cố.'
        : 'The diagram clearly defines API Gateway boundaries, business service clusters, and distributed storage tiers. Consider adding circuit breaker patterns for broker downtime resilience.',
      detectedComponents: [
        'Ingress Load Balancer (Nginx/ALB)',
        'API Gateway & Auth Proxy',
        'Core Order / Payment Microservices',
        'Redis Cluster (Distributed Cache)',
        'Apache Kafka (Event Stream Broker)',
        'PostgreSQL Primary / Replica DB',
      ],
      strengths: isVi
        ? [
            'Tách biệt luồng ghi bất đồng bộ qua Kafka Message Broker',
            'Đệm dữ liệu đọc với Redis Cluster giúp giảm 80% tải Database',
            'Sử dụng Ingress Load Balancer loại bỏ điểm nghẽn đơn lẻ (No SPOF)',
          ]
        : [
            'Asynchronous write buffering through Kafka Message Broker',
            'Read caching layer with Redis Cluster reducing 80% DB read load',
            'Ingress Load Balancer eliminating single points of failure (No SPOF)',
          ],
      bottlenecks: isVi
        ? [
            'Độ trễ replication lag giữa PostgreSQL Primary và Replica khi đọc ngay sau ghi',
            'Cần làm rõ chiến lược dọn dẹp Cache eviction (LRU / TTL expiry)',
          ]
        : [
            'Replication lag between PostgreSQL Primary and Replicas during read-after-write',
            'Cache eviction strategy needs explicit policy (LRU / TTL expiry)',
          ],
      recommendations: isVi
        ? [
            'Thêm OpenTelemetry tracing collector để theo dõi độ trễ End-to-End',
            'Thiết lập Rate Limiter tại API Gateway để chống tấn công DDoS',
          ]
        : [
            'Instrument OpenTelemetry distributed tracing to observe end-to-end latency',
            'Add token bucket Rate Limiter at API Gateway against volumetric traffic spikes',
          ],
      annotations: [
        {
          x: 15,
          y: 20,
          width: 25,
          height: 18,
          label: 'API Gateway & Ingress',
          severity: 'good',
          suggestion: isVi ? 'Cấu hình cân bằng tải và xác thực token JWT tốt.' : 'Well-designed ingress load balancing and JWT auth.',
        },
        {
          x: 45,
          y: 25,
          width: 30,
          height: 25,
          label: 'Microservices Cluster',
          severity: 'suggestion',
          suggestion: isVi ? 'Nên bổ sung Circuit Breaker (Resilience4j / Envoy) chống đổ vỡ dây chuyền.' : 'Add Circuit Breaker pattern to prevent cascading failures.',
        },
        {
          x: 50,
          y: 60,
          width: 35,
          height: 25,
          label: 'Database Primary / Replica',
          severity: 'warning',
          suggestion: isVi ? 'Cân nhắc xử lý replication lag khi đọc sau ghi bằng Sticky Session.' : 'Consider read-after-write consistency window using session pinning.',
        },
      ],
    };
  }
}
