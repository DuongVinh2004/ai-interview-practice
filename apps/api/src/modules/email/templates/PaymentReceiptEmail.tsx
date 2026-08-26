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

export interface PaymentReceiptEmailProps {
  userName: string;
  planName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  invoiceId: string;
  paidAt: string;
  dashboardUrl: string;
  language?: 'vi' | 'en';
}

export const PaymentReceiptEmail = ({
  userName = 'Member',
  planName = 'Pro Plan (Monthly)',
  amount = 19.99,
  currency = 'USD',
  paymentMethod = 'VietQR (PayOS)',
  invoiceId = 'INV-2026-001',
  paidAt = '2026-08-25',
  dashboardUrl = 'https://ai-interview.dev/billing',
  language = 'vi',
}: PaymentReceiptEmailProps) => {
  const isVi = language === 'vi';
  const formattedAmount =
    currency === 'VND'
      ? `${Number(amount).toLocaleString('vi-VN')} VND`
      : `$${Number(amount).toFixed(2)} USD`;

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
            {isVi ? '🧾 Hóa Đơn Xác Nhận Thanh Toán Dịch Vụ' : '🧾 Payment Receipt & Confirmation'}
          </Heading>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px' }}>
            {isVi ? `Kính gửi ${userName},` : `Dear ${userName},`}
          </Text>
          <Text style={{ color: '#374151', fontSize: '16px', lineHeight: '24px' }}>
            {isVi
              ? `Cảm ơn bạn đã nâng cấp gói ${planName}. Giao dịch thanh toán của bạn đã được ghi nhận thành công.`
              : `Thank you for subscribing to ${planName}. Your payment has been processed successfully.`}
          </Text>

          <Section
            style={{
              backgroundColor: '#f8fafc',
              padding: '20px',
              borderRadius: '8px',
              margin: '20px 0',
              border: '1px solid #e2e8f0',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0', color: '#64748b', fontSize: '14px' }}>
                    {isVi ? 'Mã Hóa Đơn:' : 'Invoice ID:'}
                  </td>
                  <td
                    style={{
                      padding: '6px 0',
                      color: '#0f172a',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      textAlign: 'right',
                    }}
                  >
                    {invoiceId}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', color: '#64748b', fontSize: '14px' }}>
                    {isVi ? 'Gói Dịch Vụ:' : 'Plan:'}
                  </td>
                  <td
                    style={{
                      padding: '6px 0',
                      color: '#0f172a',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      textAlign: 'right',
                    }}
                  >
                    {planName}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', color: '#64748b', fontSize: '14px' }}>
                    {isVi ? 'Phương Thức:' : 'Payment Method:'}
                  </td>
                  <td
                    style={{
                      padding: '6px 0',
                      color: '#0f172a',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      textAlign: 'right',
                    }}
                  >
                    {paymentMethod}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 0', color: '#64748b', fontSize: '14px' }}>
                    {isVi ? 'Ngày Thanh Toán:' : 'Payment Date:'}
                  </td>
                  <td
                    style={{
                      padding: '6px 0',
                      color: '#0f172a',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      textAlign: 'right',
                    }}
                  >
                    {paidAt}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={2}
                    style={{
                      borderTop: '1px solid #cbd5e1',
                      paddingTop: '10px',
                      marginTop: '10px',
                    }}
                  >
                    <table style={{ width: '100%' }}>
                      <tbody>
                        <tr>
                          <td style={{ color: '#0f172a', fontSize: '16px', fontWeight: 'bold' }}>
                            {isVi ? 'Tổng Tiền Đã Trả:' : 'Amount Paid:'}
                          </td>
                          <td
                            style={{
                              color: '#16a34a',
                              fontSize: '18px',
                              fontWeight: 'bold',
                              textAlign: 'right',
                            }}
                          >
                            {formattedAmount}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button
              href={dashboardUrl}
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
              {isVi ? 'Quản Lý Hạn Mức & Gói Dịch Vụ' : 'Go to Billing Dashboard'}
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

export default PaymentReceiptEmail;
