import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics aligned with Production SLO
export const errorRate = new Rate('custom_error_rate');
export const sessionCreationDuration = new Trend('interview_session_creation_duration_ms');
export const answerSubmissionDuration = new Trend('interview_answer_submission_duration_ms');
export const successfulInterviews = new Counter('successful_interviews_total');

// Test options: Ramp-up, Plateau, Spike, Ramp-down
export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp-up to 50 VUs
    { duration: '1m', target: 100 }, // Ramp-up to 100 VUs
    { duration: '2m', target: 100 }, // Sustain 100 VUs under typical load
    { duration: '30s', target: 200 }, // Spike test to 200 VUs
    { duration: '30s', target: 0 }, // Graceful ramp-down
  ],
  thresholds: {
    // SLO Alert 2: HighHttpLatencyP95 (p95 must remain < 800ms)
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    // SLO Alert 1: HighHttp5xxErrorRate (failure rate < 1%)
    http_req_failed: ['rate<0.01'],
    custom_error_rate: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api/v1';
const CANDIDATE_EMAIL = __ENV.DEMO_CANDIDATE_EMAIL || 'candidate@example.com';
const CANDIDATE_PASSWORD = __ENV.DEMO_CANDIDATE_PASSWORD || 'Candidate@123456';

export default function () {
  const commonHeaders = {
    'Content-Type': 'application/json',
    'x-csrf-protection': '1',
  };

  // 1. Health Liveness Check
  const healthRes = http.get(`${BASE_URL}/health/live`);
  const healthOk = check(healthRes, {
    'health live status is 200': r => r.status === 200,
  });
  errorRate.add(!healthOk);

  // 2. Candidate Authentication
  const loginPayload = JSON.stringify({
    email: CANDIDATE_EMAIL,
    password: CANDIDATE_PASSWORD,
  });

  const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
    headers: commonHeaders,
  });

  const loginOk = check(loginRes, {
    'login status is 200': r => r.status === 200,
    'login returned accessToken': r => {
      try {
        const body = JSON.parse(r.body);
        return Boolean(body.accessToken || body.token);
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!loginOk);

  if (!loginOk) {
    sleep(1);
    return;
  }

  let accessToken;
  try {
    const body = JSON.parse(loginRes.body);
    accessToken = body.accessToken || body.token;
  } catch {
    return;
  }

  const authHeaders = {
    ...commonHeaders,
    Authorization: `Bearer ${accessToken}`,
  };

  // 3. Create Interview Session with Idempotency Key
  const idempotencyKey = `k6-session-${__VU}-${__ITER}-${Date.now()}`;
  const createSessionPayload = JSON.stringify({
    jobRoleId: '00000000-0000-0000-0000-000000000001',
    seniorityLevelId: '00000000-0000-0000-0000-000000000002',
    technologyIds: ['00000000-0000-0000-0000-000000000003'],
    sessionMode: 'STANDARD',
    language: 'vi',
    totalTurns: 5,
  });

  const sessionStart = Date.now();
  const createRes = http.post(`${BASE_URL}/interviews`, createSessionPayload, {
    headers: {
      ...authHeaders,
      'Idempotency-Key': idempotencyKey,
    },
  });
  sessionCreationDuration.add(Date.now() - sessionStart);

  const createOk = check(createRes, {
    'create interview status is 201 or 200': r => r.status === 201 || r.status === 200,
    'session id present in response': r => {
      try {
        const body = JSON.parse(r.body);
        return Boolean(body.id);
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!createOk);

  if (!createOk) {
    sleep(1);
    return;
  }

  let sessionId;
  try {
    sessionId = JSON.parse(createRes.body).id;
  } catch {
    return;
  }

  sleep(0.5);

  // 4. Retrieve Interview Session & Question Turns
  const getRes = http.get(`${BASE_URL}/interviews/${sessionId}`, {
    headers: authHeaders,
  });

  const getOk = check(getRes, {
    'get interview status is 200': r => r.status === 200,
    'session has turns initialized': r => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.turns) && body.turns.length > 0;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!getOk);

  // 5. Submit Text Answer for Current Active Turn
  const answerPayload = JSON.stringify({
    answer:
      'Trong kiến trúc phân tán, để đảm bảo tính sẵn sàng và nhất quán, chúng tôi áp dụng chiến lược Database Read-Replica kết hợp Redis Caching có TTL và cơ chế khóa phân tán Redlock khi xử lý mutation giao dịch.',
  });

  const answerStart = Date.now();
  const answerRes = http.post(`${BASE_URL}/interviews/${sessionId}/answers`, answerPayload, {
    headers: {
      ...authHeaders,
      'Idempotency-Key': `k6-answer-${sessionId}-turn1`,
    },
  });
  answerSubmissionDuration.add(Date.now() - answerStart);

  const answerOk = check(answerRes, {
    'submit answer status is 200': r => r.status === 200,
  });
  errorRate.add(!answerOk);

  // 6. Check Lightweight Status Polling Endpoint
  const statusRes = http.get(`${BASE_URL}/interviews/${sessionId}/status`, {
    headers: authHeaders,
  });

  const statusOk = check(statusRes, {
    'get session status is 200': r => r.status === 200,
  });
  errorRate.add(!statusOk);

  if (healthOk && loginOk && createOk && getOk && answerOk && statusOk) {
    successfulInterviews.add(1);
  }

  sleep(1);
}
