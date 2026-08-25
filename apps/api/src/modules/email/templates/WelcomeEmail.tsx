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

export interface WelcomeEmailProps {
  userName: string;
  loginUrl: string;
  language?: 'vi' | 'en';
}

export const WelcomeEmail = ({
  userName = 'Developer',
  loginUrl = 'https://ai-interview.dev/login',
  language = 'vi',
}: WelcomeEmailProps) => {
  const isVi = language === 'vi';

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Helvetica, Arial, sans-serif', backgroundColor: '#f3f4f6', margin: 0, padding: 0 }}>
        <Container style={{ margin: '30px auto', padding: '32px', backgroundColor: '#ffffff', borderRadius: '8px', maxWidth: '600px', border: '1px solid #e5e7eb' }}>
          <Heading style={{ color: '#111827', fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
            {isVi ? '🎉 Chào mừng đến với AI Interview Practice!' : '🎉 Welcome to AI Interview Practice!'}
          </Heading>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px' }}>
            {isVi ? `Xin chào ${userName},` : `Hi ${userName},`}
          </Text>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px' }}>
            {isVi
              ? 'Chúc mừng bạn đã tạo tài khoản thành công. Hệ thống luyện phỏng vấn AI với độ trễ siêu thấp và phân tích đa phương thức đã sẵn sàng đồng hành cùng sự nghiệp của bạn.'
              : 'Congratulations on creating your account. Your ultra-low latency, multimodal AI technical mock interview platform is ready to accelerate your engineering career.'}
          </Text>
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button
              href={loginUrl}
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
              {isVi ? 'Bắt Đầu Luyện Phỏng Vấn' : 'Start Practicing Now'}
            </Button>
          </Section>
          <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
          <Text style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center' }}>
            {isVi
              ? '© 2026 AI Interview Practice. Nền tảng luyện phỏng vấn kỹ thuật tiêu chuẩn quốc tế.'
              : '© 2026 AI Interview Practice. Production-grade technical interview coaching.'}
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;
