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

export interface PasswordResetEmailProps {
  userName: string;
  resetUrl: string;
  expiresInMinutes?: number;
  language?: 'vi' | 'en';
}

export const PasswordResetEmail = ({
  userName = 'Developer',
  resetUrl = 'https://ai-interview.dev/reset-password?token=test',
  expiresInMinutes = 60,
  language = 'vi',
}: PasswordResetEmailProps) => {
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
            {isVi ? '🔒 Yêu cầu đặt lại mật khẩu' : '🔒 Password Reset Request'}
          </Heading>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px' }}>
            {isVi ? `Xin chào ${userName},` : `Hi ${userName},`}
          </Text>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px' }}>
            {isVi
              ? `Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản AI Interview Practice của bạn. Liên kết bên dưới có hiệu lực trong ${expiresInMinutes} phút:`
              : `We received a request to reset the password for your AI Interview Practice account. The link below is valid for ${expiresInMinutes} minutes:`}
          </Text>
          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button
              href={resetUrl}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                padding: '14px 28px',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 'bold',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              {isVi ? 'Đặt Lại Mật Khẩu' : 'Reset My Password'}
            </Button>
          </Section>
          <Text style={{ color: '#6b7280', fontSize: '14px', lineHeight: '20px' }}>
            {isVi
              ? 'Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email. Mật khẩu hiện tại của bạn vẫn an toàn.'
              : 'If you did not request this action, please safely ignore this email. Your current password remains secure.'}
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

export default PasswordResetEmail;
