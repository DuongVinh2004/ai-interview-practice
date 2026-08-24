import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/modules/platform/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/modules/platform/interceptors/transform.interceptor';

describe('AI Interview Practice API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/api/v1/health/live (GET) should return 200 and liveness payload', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('/api/v1/taxonomies/job-roles (GET) should return array of active roles', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/taxonomies/job-roles');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('/api/v1/auth/register (POST) validation error returns standard error schema', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'invalid-email-format',
      password: '123',
      fullName: '',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBeDefined();
    expect(res.body.message).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
  });
});
