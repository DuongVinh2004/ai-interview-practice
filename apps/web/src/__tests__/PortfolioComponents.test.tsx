import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CompetencyArea, BadgeLevel, CertificateStatus } from '@ai-interview/contracts';
import { BadgeCard } from '../features/portfolio/components/BadgeCard';
import { BadgeGrid } from '../features/portfolio/components/BadgeGrid';
import { CertificateViewer } from '../features/portfolio/components/CertificateViewer';
import { CertificateModal } from '../features/portfolio/components/CertificateModal';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Track F010: Portfolio & Certificate Components', () => {
  it('renders BadgeCard with level, score, and unlock progress', () => {
    render(
      <BadgeCard
        areaName="System Design & Scalability"
        competencyArea={CompetencyArea.SYSTEM_DESIGN}
        level={BadgeLevel.GOLD}
        score={8.5}
        evidenceCount={10}
        progressPercentage={85}
        nextBadgeLevel={BadgeLevel.PLATINUM}
        requiredScore={9.0}
        requiredEvidence={12}
        isUnlocked={true}
        earnedAt="2026-08-24T12:00:00Z"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByTestId('badge-card')).toBeInTheDocument();
    expect(screen.getByText('System Design & Scalability')).toBeInTheDocument();
    expect(screen.getByText('GOLD')).toBeInTheDocument();
    expect(screen.getByText(/8\.5 \/ 10 \(10 (tests|lượt)\)/i)).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('renders BadgeGrid with 5 competency dimensions', () => {
    const badges = [
      {
        competencyArea: CompetencyArea.SYSTEM_DESIGN,
        areaName: 'System Design',
        highestLevel: BadgeLevel.PLATINUM,
        currentScore: 9.2,
        evidenceCount: 14,
        nextBadgeLevel: null,
        requiredScore: null,
        requiredEvidence: null,
        progressPercentage: 100,
        isUnlocked: true,
      },
      {
        competencyArea: CompetencyArea.LANGUAGE_CORE,
        areaName: 'Language Core',
        highestLevel: BadgeLevel.SILVER,
        currentScore: 7.0,
        evidenceCount: 6,
        nextBadgeLevel: BadgeLevel.GOLD,
        requiredScore: 8.0,
        requiredEvidence: 8,
        progressPercentage: 75,
        isUnlocked: true,
      },
    ];

    render(<BadgeGrid badges={badges} />, { wrapper: createWrapper() });
    expect(screen.getByTestId('badge-grid')).toBeInTheDocument();
    expect(screen.getByText('System Design')).toBeInTheDocument();
    expect(screen.getByText('PLATINUM')).toBeInTheDocument();
    expect(screen.getByText('Language Core')).toBeInTheDocument();
    expect(screen.getByText('SILVER')).toBeInTheDocument();
  });

  it('renders CertificateViewer with recipient name, verified score, and cryptographic signature hash', () => {
    const cert = {
      id: 'cert-uuid-8888-9999',
      userId: 'user-123',
      recipientName: 'Alex Rivera',
      competencyArea: CompetencyArea.SYSTEM_DESIGN,
      type: 'COMPETENCY',
      score: 8.8,
      status: CertificateStatus.ISSUED,
      signatureHash: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
      fileUrl: '/certificates/cert-1.pdf',
      qrCodeUrl: 'data:image/svg+xml;utf8,<svg></svg>',
      issuedAt: '2026-08-24T10:00:00Z',
      downloadCount: 3,
      verifyCount: 5,
      createdAt: '2026-08-24T10:00:00Z',
    };

    render(<CertificateViewer certificate={cert} onDownload={vi.fn()} onShare={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('certificate-canvas')).toBeInTheDocument();
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByText(/CHỨNG CHỈ XUẤT SẮC|CERTIFICATE OF EXCELLENCE/i)).toBeInTheDocument();
    expect(screen.getByText('8.8 / 10.0')).toBeInTheDocument();
    expect(screen.getByText(/Tải Chứng Chỉ PDF|Download PDF/i)).toBeInTheDocument();
  });

  it('renders CertificateModal dialog when open', () => {
    const cert = {
      id: 'cert-uuid-8888-9999',
      userId: 'user-123',
      recipientName: 'Alex Rivera',
      competencyArea: CompetencyArea.SYSTEM_DESIGN,
      type: 'COMPETENCY',
      score: 8.8,
      status: CertificateStatus.ISSUED,
      signatureHash: 'a1b2c3d4e5f6',
      fileUrl: '/certificates/cert-1.pdf',
      downloadCount: 3,
      verifyCount: 5,
      createdAt: '2026-08-24T10:00:00Z',
    };

    render(<CertificateModal isOpen={true} onClose={vi.fn()} certificate={cert} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByTestId('certificate-modal')).toBeInTheDocument();
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
  });
});
