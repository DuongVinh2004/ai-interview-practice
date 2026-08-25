import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CvUploadZone } from '../components/setup/CvUploadZone';
import { JdInputCard } from '../components/setup/JdInputCard';
import { GapAnalysisPreview } from '../components/setup/GapAnalysisPreview';
import { InterviewBlueprintDto } from '@ai-interview/contracts';

describe('DocumentParser Components (F004)', () => {
  it('renders CvUploadZone and allows switching to text input mode', () => {
    const onParsed = vi.fn();
    const onParseText = vi.fn().mockResolvedValue({ parsedProfile: { skills: ['TypeScript'] } });
    const onParseFile = vi.fn().mockResolvedValue({ parsedProfile: { skills: ['TypeScript'] } });

    render(
      <CvUploadZone
        onParsed={onParsed}
        isParsing={false}
        onParseText={onParseText}
        onParseFile={onParseFile}
      />,
    );

    expect(screen.getByTestId('cv-upload-zone')).toBeInTheDocument();
    expect(screen.getByText(/Resume \/ CV Upload/i)).toBeInTheDocument();

    // Switch to paste text mode
    const textBtn = screen.getByText('Paste Text');
    fireEvent.click(textBtn);

    const textarea = screen.getByPlaceholderText(/Dán nội dung tóm tắt kinh nghiệm/i);
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, {
      target: { value: 'Senior Backend Engineer with 5 years experience in Node.js' },
    });
    const submitBtn = screen.getByText('Phân tích nội dung CV');
    fireEvent.click(submitBtn);

    expect(onParseText).toHaveBeenCalledWith(
      'Senior Backend Engineer with 5 years experience in Node.js',
    );
  });

  it('renders JdInputCard and submits job description text', () => {
    const onAnalyzed = vi.fn();
    const onAnalyzeJd = vi
      .fn()
      .mockResolvedValue({ id: 'jd-1', roleTitle: 'Senior Backend Engineer' });

    render(<JdInputCard onAnalyzed={onAnalyzed} isAnalyzing={false} onAnalyzeJd={onAnalyzeJd} />);

    expect(screen.getByTestId('jd-input-card')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Dán toàn bộ nội dung tuyển dụng/i);
    fireEvent.change(textarea, {
      target: {
        value:
          'We are seeking a Senior Backend Engineer proficient in Node.js, PostgreSQL, and Kafka.',
      },
    });

    const submitBtn = screen.getByText('Phân tích yêu cầu JD');
    fireEvent.click(submitBtn);

    expect(onAnalyzeJd).toHaveBeenCalled();
  });

  it('renders GapAnalysisPreview with match percentage and topics breakdown', () => {
    const mockBlueprint: InterviewBlueprintDto = {
      id: 'bp-123',
      parsedProfileId: 'prof-1',
      jdAnalysisId: 'jd-1',
      targetRole: 'Senior Backend Engineer',
      targetLevel: 'SENIOR',
      matchPercentage: 75,
      matchedSkills: ['TypeScript', 'Node.js', 'PostgreSQL'],
      gapSkills: ['Kafka', 'Kubernetes'],
      topics: [
        {
          topic: 'Remediation: Kafka & Distributed Streaming',
          weight: 40,
          reason: 'Deep-dive into missing messaging queue requirement',
          sampleQuestions: ['How would you implement consumer groups in Kafka?'],
          cvReference: 'Project comparison',
        },
      ],
      recommendations: ['Review Kafka broker partition rebalancing'],
    };

    const onProceed = vi.fn();

    render(<GapAnalysisPreview blueprint={mockBlueprint} onProceed={onProceed} />);

    expect(screen.getByTestId('gap-analysis-preview')).toBeInTheDocument();
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Kafka')).toBeInTheDocument();
    expect(screen.getByText('Remediation: Kafka & Distributed Streaming')).toBeInTheDocument();

    const proceedBtn = screen.getByText(/Bắt đầu phiên phỏng vấn may đo/i);
    fireEvent.click(proceedBtn);

    expect(onProceed).toHaveBeenCalledWith('bp-123');
  });
});
