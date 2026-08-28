import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StickySetupSummary } from '../components/setup/StickySetupSummary';
import { SessionMode } from '@ai-interview/contracts';

describe('StickySetupSummary Component', () => {
  const mockOnStart = vi.fn();

  const mockRole = {
    id: 'role-1',
    slug: 'backend-engineer',
    name: 'Backend Engineer',
    description: 'Backend',
    isActive: true,
  };
  const mockLevel = {
    id: 'level-1',
    slug: 'senior',
    name: 'Senior',
    order: 4,
    description: 'Senior',
    isActive: true,
  };
  const mockTechs = [
    { id: 't1', slug: 'java', name: 'Java', category: 'Language', isActive: true },
    { id: 't2', slug: 'spring', name: 'Spring Boot', category: 'Backend', isActive: true },
  ];

  it('renders selected role, level, skills and source badges', () => {
    render(
      <StickySetupSummary
        selectedRole={mockRole}
        selectedLevel={mockLevel}
        selectedTechObjects={mockTechs}
        sessionMode={SessionMode.STANDARD}
        interviewLanguage="vi"
        totalTurns={5}
        fieldSources={{ role: 'cv', level: 'preset', techs: 'manual' }}
        activePresetName="My Pro Preset"
        hasCvProfile={true}
        isSubmitting={false}
        validationErrors={{}}
        onStartInterview={mockOnStart}
      />,
    );

    expect(screen.getByText('Tóm Tắt Cấu Hình')).toBeInTheDocument();
    expect(screen.getByText(/Senior Backend Engineer/i)).toBeInTheDocument();
    expect(screen.getByText('từ CV')).toBeInTheDocument();
    expect(screen.getByText('đã chỉnh sửa')).toBeInTheDocument();
    expect(screen.getByText('Java')).toBeInTheDocument();
    expect(screen.getByText('Spring Boot')).toBeInTheDocument();

    const startBtn = screen.getByRole('button', { name: /Bắt Đầu Phỏng Vấn Ngay/i });
    expect(startBtn).not.toBeDisabled();
    fireEvent.click(startBtn);
    expect(mockOnStart).toHaveBeenCalled();
  });

  it('disables CTA button and shows error notice if validation errors exist', () => {
    render(
      <StickySetupSummary
        selectedRole={undefined}
        selectedLevel={undefined}
        selectedTechObjects={[]}
        sessionMode={SessionMode.STANDARD}
        interviewLanguage="vi"
        totalTurns={5}
        fieldSources={{}}
        hasCvProfile={false}
        isSubmitting={false}
        validationErrors={{ role: 'Vui lòng chọn vị trí', techs: 'Chọn ít nhất 1 kỹ năng' }}
        onStartInterview={mockOnStart}
      />,
    );

    expect(screen.getByText(/Vui lòng hoàn tất:/i)).toBeInTheDocument();
    expect(screen.getByText(/Chọn vị trí công việc/i)).toBeInTheDocument();
    const startBtn = screen.getByRole('button', { name: /Bắt Đầu Phỏng Vấn Ngay/i });
    expect(startBtn).toBeDisabled();
  });
});
