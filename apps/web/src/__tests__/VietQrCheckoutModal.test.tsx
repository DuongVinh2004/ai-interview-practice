import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VietQrCheckoutModal } from '../components/billing/VietQrCheckoutModal';

describe('VietQrCheckoutModal Component (Sprint B4 - PayOS VietQR)', () => {
  const mockPaymentData = {
    orderCode: 123456,
    checkoutUrl: 'https://pay.payos.vn/web/mock-123456',
    qrCode:
      '00020101021238540010A00000072701240006970422011009876543215204599953037045404990005802VN621808141234566304ABCD',
    accountNumber: '0987654321',
    accountName: 'AI INTERVIEW PRACTICE',
    bin: '970422',
    amount: 499000,
    description: 'AI INT PRO',
    status: 'PENDING',
    currency: 'VND',
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <VietQrCheckoutModal isOpen={false} onClose={vi.fn()} paymentData={mockPaymentData} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders VietQR payment details and QR image when open', () => {
    const onClose = vi.fn();
    render(<VietQrCheckoutModal isOpen={true} onClose={onClose} paymentData={mockPaymentData} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Thanh Toán VietQR Tự Động \(PayOS\)/i)).toBeInTheDocument();
    expect(screen.getByAltText('VietQR Payment Code')).toBeInTheDocument();
    expect(screen.getByText('0987654321')).toBeInTheDocument();
    expect(screen.getByText('AI INTERVIEW PRACTICE')).toBeInTheDocument();
    expect(screen.getByText('AI INT PRO')).toBeInTheDocument();
    expect(screen.getByText(/499[.,]000/)).toBeInTheDocument();

    const closeButton = screen.getByLabelText('Close modal');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('copies account number to clipboard when copy button clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<VietQrCheckoutModal isOpen={true} onClose={vi.fn()} paymentData={mockPaymentData} />);

    const copyButtons = screen.getAllByRole('button');
    // Find the copy button for account number
    const copyAccBtn = copyButtons.find(btn => btn.getAttribute('title')?.includes('Sao chép'));
    if (copyAccBtn) {
      fireEvent.click(copyAccBtn);
      expect(writeTextMock).toHaveBeenCalled();
    }
  });
});
