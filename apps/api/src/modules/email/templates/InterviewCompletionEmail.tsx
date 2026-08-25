import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Button,
  Section,
  Heading,
  Hr,
} from '@react-email/components';

export interface InterviewCompletionEmailProps {
  userName: string;
  jobRole: string;
  overallScore: number;
  resultsUrl: string;
  keyStrengths?: string[];
  growthAreas?: string[];
  language?: 'vi' | 'en';
}

export const InterviewCompletionEmail = ({
  userName = 'Candidate',
  jobRole = 'Senior Backend Engineer',
  overallScore = 8.5,
  resultsUrl = 'https://ai-interview.dev/sessions/1',
  keyStrengths = ['Deep understanding of distributed caching', 'Clean REST/gRPC API contract design'],
  growthAreas = ['Database replication lag considerations', 'Circuit breaker fallback strategies'],
  language = 'vi',
}: InterviewCompletionEmailProps) => {
  const isVi = language === 'vi';

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Helvetica, Arial, sans-serif', backgroundColor: '#f3f4f6', margin: 0, padding: 0 }}>
        <Container style={{ margin: '30px auto', padding: '32px', backgroundColor: '#ffffff', borderRadius: '8px', maxWidth: '600px', border: '1px solid #e5e7eb' }}>
          <Heading style={{ color: '#111827', fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
            {isVi ? '📊 Kết Quả Phỏng Vấn Thử Của Bạn Đã Sẵn Sàng!' : '📊 Your Mock Interview Results are Ready!'}
          </Heading>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px' }}>
            {isVi ? `Chào ${userName},` : `Hi ${userName},`}
          </Text>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px' }}>
            {isVi
              ? `Bạn vừa hoàn thành xuất sắc buổi phỏng vấn vị trí ${jobRole}. Dưới đây là tóm tắt đánh giá năng lực của bạn:`
              : `You recently completed a mock technical session for the ${jobRole} role. Here is your evaluation summary:`}
          </Text>

          <Section style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', margin: '20px 0', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <Text style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {isVi ? 'Điểm Tổng Kết' : 'Overall Performance Score'}
            </Text>
            <Text style={{ margin: '8px 0 0 0', fontSize: '36px', color: overallScore >= 7 ? '#16a34a' : '#ea580c', fontWeight: 'bold' }}>
              {overallScore.toFixed(1)} / 10.0
            </Text>
          </Section>

          {keyStrengths && keyStrengths.length > 0 && (
            <Section style={{ margin: '16px 0' }}>
              <Text style={{ fontWeight: 'bold', color: '#15803d', fontSize: '15px', marginBottom: '6px' }}>
                {isVi ? '✅ Điểm mạnh nổi bật:' : '✅ Key Technical Strengths:'}
              </Text>
              {keyStrengths.map((str, idx) => (
                <Text key={idx} style={{ margin: '4px 0', color: '#374151', fontSize: '14px' }}>
                  • {str}
                </Text>
              ))}
            </Section>
          )}

          {growthAreas && growthAreas.length > 0 && (
            <Section style={{ margin: '16px 0' }}>
              <Text style={{ fontWeight: 'bold', color: '#b45309', fontSize: '15px', marginBottom: '6px' }}>
                {isVi ? '🎯 Lỗ hổng cần ôn tập (Learning Path):' : '🎯 Actionable Improvement Areas:'}
              </Text>
              {growthAreas.map((area, idx) => (
                <Text key={idx} style={{ margin: '4px 0', color: '#374151', fontSize: '14px' }}>
                  • {area}
                </Text>
              ))}
            </Section>
          )}

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button
              href={resultsUrl}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '14px 28px',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 'bold',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              {isVi ? 'Xem Chi Tiết & Lộ Trình Học' : 'View Full Report & Learning Path'}
            </Button>
          </Section>

          <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
          <Text style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>
            © 2026 AI Interview Practice.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default InterviewCompletionEmail;
