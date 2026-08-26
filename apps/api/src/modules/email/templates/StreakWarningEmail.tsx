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

export interface StreakWarningEmailProps {
  userName: string;
  currentStreak: number;
  practiceUrl: string;
  language?: 'vi' | 'en';
}

export const StreakWarningEmail = ({
  userName = 'Developer',
  currentStreak = 5,
  practiceUrl = 'https://ai-interview.dev/setup',
  language = 'vi',
}: StreakWarningEmailProps) => {
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
            style={{ color: '#dc2626', fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}
          >
            {isVi
              ? '🔥 Nguy cơ mất chuỗi Streak học tập hôm nay!'
              : '🔥 Danger! Your Practice Streak is at Risk!'}
          </Heading>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px' }}>
            {isVi ? `Chào ${userName},` : `Hi ${userName},`}
          </Text>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px' }}>
            {isVi
              ? `Bạn đang duy trì chuỗi ấn tượng ${currentStreak} ngày luyện tập liên tục. Đừng để chuỗi ngày bị ngắt quãng trước 00:00 đêm nay!`
              : `You are on an impressive ${currentStreak}-day practice streak. Don't let it reset at midnight!`}
          </Text>

          <Section
            style={{
              backgroundColor: '#fef2f2',
              padding: '20px',
              borderRadius: '8px',
              margin: '20px 0',
              border: '1px solid #fecaca',
              textAlign: 'center',
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: '14px',
                color: '#991b1b',
                fontWeight: 'bold',
                textTransform: 'uppercase',
              }}
            >
              {isVi ? 'Chuỗi Ngày Hiện Tại' : 'Current Active Streak'}
            </Text>
            <Text
              style={{
                margin: '8px 0 0 0',
                fontSize: '36px',
                color: '#dc2626',
                fontWeight: 'bold',
              }}
            >
              🔥 {currentStreak} {isVi ? 'NGÀY' : 'DAYS'}
            </Text>
          </Section>

          <Text style={{ color: '#4b5563', fontSize: '15px', lineHeight: '22px' }}>
            {isVi
              ? 'Chỉ cần hoàn thành 1 câu hỏi nhanh trong Sandbox Drill hoặc ôn 5 thẻ Flashcard để bảo toàn chuỗi ngày và nhận thêm +15 XP.'
              : 'Complete just 1 quick practice sandbox turn or review 5 flashcards to preserve your streak and earn +15 XP.'}
          </Text>

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button
              href={practiceUrl}
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
              {isVi ? 'Luyện Tập Ngay Để Giữ Chuỗi' : 'Practice Now to Save Streak'}
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

export default StreakWarningEmail;
