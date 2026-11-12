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

export interface EmailVerificationEmailProps {
  userName: string;
  verificationUrl: string;
  expiresInHours?: number;
  language?: 'vi' | 'en';
}

export const EmailVerificationEmail = ({
  userName = 'Developer',
  verificationUrl = 'https://ai-interview.dev/verify-email?token=test',
  expiresInHours = 24,
  language = 'vi',
}: EmailVerificationEmailProps) => {
  const isVi = language === 'vi';

  return (
    <Html>
      <Head />
      <Body
        style={{
          fontFamily: 'Helvetica, Arial, sans-serif',
          backgroundColor: '#f3f4f6',
          margin: 0,
          padding: 0,
        }}
      >
        <Container
          style={{
            margin: '30px auto',
            padding: '32px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            maxWidth: '600px',
            border: '1px solid #e5e7eb',
          }}
        >
          <Heading
            style={{ color: '#111827', fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}
          >
            {isVi ? '✉️ Xác thực địa chỉ email' : '✉️ Verify Your Email Address'}
          </Heading>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px' }}>
            {isVi ? `Xin chào ${userName},` : `Hi ${userName},`}
          </Text>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px' }}>
            {isVi
              ? `Vui lòng nhấp vào nút bên dưới để xác thực địa chỉ email của bạn. Liên kết có hiệu lực trong ${expiresInHours} giờ:`
              : `Please click the button below to verify your email address. This link is valid for ${expiresInHours} hours:`}
          </Text>
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button
              href={verificationUrl}
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
              {isVi ? 'Xác Thực Email' : 'Verify Email'}
            </Button>
          </Section>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '20px' }}>
            {isVi
              ? 'Nếu bạn không tạo tài khoản trên AI Interview Practice, bạn có thể an tâm bỏ qua email này.'
              : 'If you did not sign up for an account on AI Interview Practice, you can safely ignore this email.'}
          </Text>
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

export default EmailVerificationEmail;
