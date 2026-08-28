import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresetConflictModal, ConflictDiffItem } from '../components/setup/PresetConflictModal';

describe('PresetConflictModal Component', () => {
  const mockOnUseCv = vi.fn();
  const mockOnApplyPreset = vi.fn();
  const mockOnSmartMerge = vi.fn();
  const mockOnClose = vi.fn();

  const mockDiffs: ConflictDiffItem[] = [
    {
      field: 'jobRoleId',
      label: 'Vị trí công việc (Role)',
      cvValue: 'Backend Developer',
      presetValue: 'Fullstack Engineer',
      resolvedValue: 'role-fs-id',
      action: 'apply_preset',
      requiresConfirmation: true,
    },
    {
      field: 'technologyIds',
      label: 'Kỹ năng công nghệ',
      cvValue: ['Java', 'Spring Boot'],
      presetValue: ['Java', 'React', 'Docker'],
      resolvedValue: ['Java', 'React', 'Docker', 'Spring Boot'],
      action: 'merge',
      requiresConfirmation: true,
    },
  ];

  it('renders diff table and 3 resolution buttons when open', () => {
    render(
      <PresetConflictModal
        isOpen={true}
        onClose={mockOnClose}
        presetName="Senior Fullstack Java"
        diffs={mockDiffs}
        onUseCv={mockOnUseCv}
        onApplyPreset={mockOnApplyPreset}
        onSmartMerge={mockOnSmartMerge}
      />,
    );

    expect(screen.getByText(/So Sánh Cấu Hình: Gợi Ý CV vs Preset Đã Lưu/i)).toBeInTheDocument();
    expect(screen.getByText('Backend Developer')).toBeInTheDocument();
    expect(screen.getByText('Fullstack Engineer')).toBeInTheDocument();
    expect(screen.getByText('Hợp nhất kỹ năng')).toBeInTheDocument();

    const cvBtn = screen.getByRole('button', { name: /Dùng Gợi Ý Từ CV/i });
    fireEvent.click(cvBtn);
    expect(mockOnUseCv).toHaveBeenCalled();

    const presetBtn = screen.getByRole('button', { name: /Áp Dụng Preset/i });
    fireEvent.click(presetBtn);
    expect(mockOnApplyPreset).toHaveBeenCalled();

    const mergeBtn = screen.getByRole('button', { name: /Tự Điều Chỉnh/i });
    fireEvent.click(mergeBtn);
    expect(mockOnSmartMerge).toHaveBeenCalled();
  });
});
