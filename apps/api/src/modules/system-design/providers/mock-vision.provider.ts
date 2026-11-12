import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { MultimodalProvider, MultimodalAnalysisOptions } from './multimodal-provider.interface';
import {
  VisionProvider,
  VisionEvaluationOptions,
  VisionEvaluationResult,
} from '../interfaces/vision-provider.interface';
import { VisionAnalysisResultDto, ErrorCode } from '@ai-interview/contracts';
import { DomainException } from '../../platform/filters/all-exceptions.filter';

@Injectable()
export class MockVisionProvider implements MultimodalProvider, VisionProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockVisionProvider.name);

  private checkProductionGuard() {
    const isProduction =
      process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
    const allowMock = process.env.ALLOW_MOCK_PROVIDERS === 'true';

    if (isProduction && !allowMock) {
      this.logger.error(
        'MockVisionProvider invoked in production without ALLOW_MOCK_PROVIDERS=true',
      );
      throw new DomainException(
        ErrorCode.INTERNAL_SERVER_ERROR,
        'Multimodal diagram evaluation service is currently unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async analyzeCanvasDiagram(options: MultimodalAnalysisOptions): Promise<VisionAnalysisResultDto> {
    this.checkProductionGuard();
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
    this.checkProductionGuard();
    this.logger.log(
      `MockVisionProvider evaluating diagram for problem: ${options.problemTitle || 'System Design'}`,
    );

    const isVi = options.language === 'vi';

    if (options.canvasData !== undefined && options.canvasData !== null) {
      let canvas: any = options.canvasData;
      if (typeof canvas === 'string') {
        try {
          canvas = JSON.parse(canvas);
        } catch {
          canvas = {};
        }
      }

      const nodes: any[] = Array.isArray(canvas)
        ? canvas
        : Array.isArray(canvas?.nodes)
          ? canvas.nodes
          : Array.isArray(canvas?.elements)
            ? canvas.elements
            : [];

      const annotationsList: any[] = Array.isArray(canvas?.annotations) ? canvas.annotations : [];

      const rawJson = JSON.stringify(canvas).toLowerCase();

      // Case 4: Empty diagram (no nodes)
      if (nodes.length === 0) {
        return {
          overallScore: 1.0,
          requirementsScore: 1.0,
          highLevelScore: 1.0,
          componentDetailScore: 1.0,
          scalabilityScore: 1.0,
          dataModelScore: 1.0,
          summary: isVi
            ? 'Sơ đồ rỗng, chưa có thành phần nào.'
            : 'Empty diagram with no components.',
          feedback: isVi
            ? 'Vui lòng bổ sung các thành phần kiến trúc cơ bản.'
            : 'Please add architectural components.',
          detectedComponents: [],
          strengths: [],
          bottlenecks: isVi
            ? ['Sơ đồ không có bất kỳ nút (node) nào']
            : ['Diagram contains no nodes'],
          recommendations: isVi
            ? ['Thêm Load Balancer, Web Services và Database']
            : ['Add Load Balancer, Services, and DB'],
          annotations: [],
        };
      }

      const hasDb =
        nodes.some(n =>
          /database|db|postgres|mysql|mongo|storage|rds|dynamo/.test(
            `${n.type || ''} ${n.label || ''} ${n.name || ''}`.toLowerCase(),
          ),
        ) || /"type":\s*"database"|"database"|"postgres"|"mysql"/.test(rawJson);

      const hasSpof =
        Boolean(canvas?.hasSpof) ||
        nodes.some(
          n =>
            Boolean(n.hasSpof) ||
            /spof|single point/.test(
              `${n.type || ''} ${n.label || ''} ${n.name || ''}`.toLowerCase(),
            ),
        ) ||
        (!nodes.some(n =>
          /load_balancer|load balancer|lb|gateway|alb|nginx/.test(
            `${n.type || ''} ${n.label || ''} ${n.name || ''}`.toLowerCase(),
          ),
        ) &&
          nodes.length > 0 &&
          !nodes.some(n => /cache/.test(`${n.type || ''} ${n.label || ''}`.toLowerCase())));

      const hasTradeoff =
        annotationsList.some(a =>
          /trade-off|tradeoff|cap theorem|availability|consistency/.test(
            `${a.text || ''} ${a.label || ''} ${a.description || ''}`.toLowerCase(),
          ),
        ) || /trade-off|tradeoff|cap theorem/.test(rawJson);

      // Rubric scores (scale 1.0 - 5.0)
      const dataModelScore = hasDb ? 4.0 : 1.5;
      const scalabilityScore = hasSpof ? 2.0 : 4.2;
      const highLevelScore = hasTradeoff ? 4.2 : 3.8;
      const requirementsScore = 3.8;
      const componentDetailScore = 3.8;
      const overallScore = Number(
        (
          (requirementsScore +
            highLevelScore +
            componentDetailScore +
            scalabilityScore +
            dataModelScore) /
          5
        ).toFixed(1),
      );

      return {
        overallScore,
        requirementsScore,
        highLevelScore,
        componentDetailScore,
        scalabilityScore,
        dataModelScore,
        summary: isVi
          ? 'Đánh giá kiến trúc hệ thống dựa trên topology các thành phần trên sơ đồ.'
          : 'System design evaluated based on canvas topology and component distribution.',
        feedback: isVi
          ? 'Kiến trúc được phân tích dựa trên sự hiện diện của Load Balancer, Services, Caching, Storage và phân tích Trade-off.'
          : 'Architecture analyzed based on LB, services, caching, storage tiers, and trade-off considerations.',
        detectedComponents: nodes.map(n => n.label || n.name || n.type || 'Component'),
        strengths: hasTradeoff
          ? [
              isVi
                ? 'Có phân tích trade-off kiến trúc rõ ràng'
                : 'Explicit architecture trade-off analysis',
            ]
          : [isVi ? 'Phân chia thành phần rõ ràng' : 'Clear component boundaries'],
        bottlenecks: !hasDb
          ? [isVi ? 'Thiếu tầng lưu trữ dữ liệu (Database)' : 'Missing database persistence layer']
          : hasSpof
            ? [
                isVi
                  ? 'Tồn tại điểm nghẽn đơn lẻ (Single Point of Failure)'
                  : 'Single point of failure detected',
              ]
            : [],
        recommendations: !hasDb
          ? [
              isVi
                ? 'Bổ sung cơ sở dữ liệu quan hệ hoặc phân tán'
                : 'Add relational or distributed database',
            ]
          : hasSpof
            ? [
                isVi
                  ? 'Thêm Load Balancer và cụm dịch vụ dự phòng'
                  : 'Add redundant instances and load balancer',
              ]
            : [],
        annotations: [],
      };
    }

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
          suggestion: isVi
            ? 'Cấu hình cân bằng tải và xác thực token JWT tốt.'
            : 'Well-designed ingress load balancing and JWT auth.',
        },
        {
          x: 45,
          y: 25,
          width: 30,
          height: 25,
          label: 'Microservices Cluster',
          severity: 'suggestion',
          suggestion: isVi
            ? 'Nên bổ sung Circuit Breaker (Resilience4j / Envoy) chống đổ vỡ dây chuyền.'
            : 'Add Circuit Breaker pattern to prevent cascading failures.',
        },
        {
          x: 50,
          y: 60,
          width: 35,
          height: 25,
          label: 'Database Primary / Replica',
          severity: 'warning',
          suggestion: isVi
            ? 'Cân nhắc xử lý replication lag khi đọc sau ghi bằng Sticky Session.'
            : 'Consider read-after-write consistency window using session pinning.',
        },
      ],
    };
  }
}
