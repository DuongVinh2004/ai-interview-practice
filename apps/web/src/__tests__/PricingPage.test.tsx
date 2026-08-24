import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PricingPage } from '../features/billing/PricingPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseBilling = vi.fn();

vi.mock('../hooks/useBilling', () => ({
  useBilling: () => mockUseBilling(),
}));

describe('PricingPage Component (F014)', () => {
  const queryClient = new QueryClient();

  const mockPlans = [
    {
      id: 'plan-1',
      slug: 'free',
      name: 'Free Forever',
      nameVi: 'Gói Miễn phí',
      description: 'Basic practice',
      priceMonthly: 0,
      priceYearly: 0,
      currency: 'USD',
      features: ['3 mock sessions/month'],
      limits: { sessionsPerMonth: 3, voiceMinutesPerMonth: 15, allowLiveCoding: true, allowSystemDesign: false, mentorFeedbackLimit: 0 },
      isActive: true,
    },
    {
      id: 'plan-2',
      slug: 'pro',
      name: 'Pro Tier',
      nameVi: 'Gói Pro',
      description: 'Advanced IT practice',
      priceMonthly: 19,
      priceYearly: 190,
      currency: 'USD',
      features: ['Unlimited AI evaluation', 'Live Coding sandbox'],
      limits: { sessionsPerMonth: 20, voiceMinutesPerMonth: 60, allowLiveCoding: true, allowSystemDesign: true, mentorFeedbackLimit: 5 },
      isActive: true,
    },
  ];

  it('renders plan cards and allows toggling between monthly and yearly billing', () => {
    mockUseBilling.mockReturnValue({
      plans: mockPlans,
      isLoadingPlans: false,
      subscription: { plan: { slug: 'free' } },
      createCheckout: vi.fn(),
      isCreatingCheckout: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <PricingPage />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('pricing-page')).toBeInTheDocument();
    expect(screen.getByTestId('pricing-card-free')).toBeInTheDocument();
    expect(screen.getByTestId('pricing-card-pro')).toBeInTheDocument();
    expect(screen.getByText('Gói Miễn phí')).toBeInTheDocument();
    expect(screen.getByText('Gói Pro')).toBeInTheDocument();

    // Toggle annual billing
    const annualBtn = screen.getByText(/Annual Billing/i);
    fireEvent.click(annualBtn);
    expect(screen.getByText(/Billed annually/i)).toBeInTheDocument();
  });
});
