import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutiveReportModal } from '../features/history/ExecutiveReportModal';
import { ScoreExplanationPopover } from '../features/evaluation/ScoreExplanationPopover';

describe('ExecutiveReportModal', () => {
  const mockResult = {
    id: 'session-exec-777',
    overallScore: 8.8,
    jobRole: { name: 'Staff Software Engineer' },
    seniorityLevel: { name: 'Staff' },
    strengths: ['Exceptional system decomposition', 'Deep DB indexing mastery'],
    improvements: ['Could elaborate on disaster recovery RPO/RTO'],
    turns: [
      {
        turnNumber: 1,
        question: { content: 'Design a globally distributed KV store.' },
        answer: {
          answerText: 'We partition data using consistent hashing and use Raft consensus.',
          evaluation: { overallScore: 9.0 },
        },
      },
    ],
  };

  it('renders Executive Candidate Dossier with Strong Hire badge and verification seal', () => {
    render(
      <ExecutiveReportModal
        isOpen={true}
        onClose={vi.fn()}
        result={mockResult}
        roleTitle="Staff Software Engineer"
      />,
    );

    expect(screen.getByText(/CANDIDATE EVALUATION DOSSIER/i)).toBeInTheDocument();
    expect(screen.getByText(/STRONG HIRE/i)).toBeInTheDocument();
    expect(screen.getByText(/8.8/i)).toBeInTheDocument();
    expect(screen.getByText(/Staff Software Engineer/i)).toBeInTheDocument();
    expect(screen.getByText(/Exceptional system decomposition/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Digital Verification Reference|Mã xác thực tham chiếu phiên/i),
    ).toBeInTheDocument();
  });

  it('triggers window.print when print button is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<ExecutiveReportModal isOpen={true} onClose={vi.fn()} result={mockResult} />);

    const printBtn = screen.getByText(/In \/ Lưu PDF|Print \/ Save PDF/i);
    fireEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });
});

describe('ScoreExplanationPopover', () => {
  const mockData = {
    criterionName: 'Technical Accuracy',
    criterionNameVi: 'Độ chính xác kỹ thuật',
    score: 8.5,
    maxScore: 10,
    weight: 0.4,
    candidateQuote: 'We partition data using consistent hashing with virtual nodes.',
    industryStandard: 'RFC 7519 & DynamoDB Partitioning Whitepaper.',
    positives: ['Virtual nodes prevent hotspotting', 'Accurate ring topology traversal'],
    penalties: ['Did not mention replication factor N=3'],
    recommendation: 'Explicitly specify quorum read/write configuration (R + W > N).',
  };

  it('renders explainable scoring modal with quote, standard benchmark, and recommendations', () => {
    const onClose = vi.fn();
    render(<ScoreExplanationPopover isOpen={true} onClose={onClose} data={mockData} />);

    expect(screen.getAllByText(/Technical Accuracy|Độ chính xác kỹ thuật/i).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText(/8.5/i)).toBeInTheDocument();
    expect(
      screen.getByText(/We partition data using consistent hashing with virtual nodes./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/RFC 7519 & DynamoDB Partitioning Whitepaper./i)).toBeInTheDocument();
    expect(screen.getByText(/Virtual nodes prevent hotspotting/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Explicitly specify quorum read\/write configuration/i),
    ).toBeInTheDocument();

    const closeBtn = screen.getByText(/Close|Đóng/i);
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
