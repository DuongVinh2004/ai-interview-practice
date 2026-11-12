import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentMethodModal } from '../components/billing/PaymentMethodModal';

describe('PaymentMethodModal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    planName: 'Gói Pro',
    planSlug: 'pro',
    priceFormatted: '499.000đ/tháng',
    billingCycle: 'monthly' as const,
    onConfirm: vi.fn(),
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(<PaymentMethodModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders payment method options: VietQR and Stripe', () => {
    render(<PaymentMethodModal {...defaultProps} />);

    expect(screen.getByTestId('payment-method-modal')).toBeInTheDocument();
    expect(screen.getByText('Chọn phương thức thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Gói Pro')).toBeInTheDocument();
    expect(screen.getByText('499.000đ/tháng')).toBeInTheDocument();
    expect(screen.getByTestId('method-payos')).toBeInTheDocument();
    expect(screen.getByTestId('method-stripe')).toBeInTheDocument();
  });

  it('defaults to VietQR (PayOS) and calls onConfirm with payos when submitted', () => {
    const onConfirm = vi.fn();
    render(<PaymentMethodModal {...defaultProps} onConfirm={onConfirm} />);

    const submitBtn = screen.getByTestId('confirm-payment-method-btn');
    fireEvent.click(submitBtn);

    expect(onConfirm).toHaveBeenCalledWith('payos');
  });

  it('allows switching to Stripe and calls onConfirm with stripe', () => {
    const onConfirm = vi.fn();
    render(<PaymentMethodModal {...defaultProps} onConfirm={onConfirm} />);

    const stripeOption = screen.getByTestId('method-stripe');
    fireEvent.click(stripeOption);

    const submitBtn = screen.getByTestId('confirm-payment-method-btn');
    fireEvent.click(submitBtn);

    expect(onConfirm).toHaveBeenCalledWith('stripe');
  });

  it('triggers onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<PaymentMethodModal {...defaultProps} onClose={onClose} />);

    const closeBtn = screen.getByLabelText('Close modal');
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
