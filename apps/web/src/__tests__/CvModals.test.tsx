import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JdInputModal } from '../components/setup/JdInputModal';
import { ExistingProfilesModal } from '../components/setup/ExistingProfilesModal';

describe('JdInputModal Component', () => {
  it('renders modal when open and handles JD analysis submission', async () => {
    const mockAnalyze = vi.fn().mockResolvedValue({
      roleTitle: 'Senior Backend Engineer',
      requiredSkills: ['Node.js', 'PostgreSQL'],
    });
    const mockClose = vi.fn();

    render(
      <JdInputModal
        isOpen={true}
        onClose={mockClose}
        onAnalyzeJd={mockAnalyze}
        isAnalyzing={false}
      />,
    );

    expect(screen.getByText(/Nhập Mô Tả Công Việc/i)).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText(/Dán toàn bộ yêu cầu tuyển dụng/i);
    fireEvent.change(textarea, {
      target: {
        value:
          'We are looking for a Senior Backend Engineer with strong Node.js, PostgreSQL and Docker experience.',
      },
    });

    const submitBtn = screen.getByRole('button', { name: /Phân tích JD bằng AI/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockAnalyze).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
    });
  });

  it('validates minimum length before submission', async () => {
    const mockAnalyze = vi.fn();
    const mockClose = vi.fn();

    render(
      <JdInputModal
        isOpen={true}
        onClose={mockClose}
        onAnalyzeJd={mockAnalyze}
        isAnalyzing={false}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Dán toàn bộ yêu cầu tuyển dụng/i);
    fireEvent.change(textarea, { target: { value: 'Short' } });

    const submitBtn = screen.getByRole('button', { name: /Phân tích JD bằng AI/i });
    expect(submitBtn).toBeDisabled();
    expect(mockAnalyze).not.toHaveBeenCalled();
  });
});

describe('ExistingProfilesModal Component', () => {
  const mockProfiles = [
    {
      id: 'p1',
      fullName: 'Tran Van B',
      targetRole: 'Frontend Developer',
      seniorityLevel: 'Senior',
      skills: ['React', 'TypeScript', 'Next.js'],
      createdAt: new Date().toISOString(),
    },
  ];

  it('renders existing profiles and allows selection', () => {
    const mockSelect = vi.fn();
    const mockClose = vi.fn();
    const mockUploadNew = vi.fn();

    render(
      <ExistingProfilesModal
        isOpen={true}
        onClose={mockClose}
        profiles={mockProfiles}
        isLoading={false}
        onSelectProfile={mockSelect}
        onUploadNew={mockUploadNew}
      />,
    );

    expect(screen.getByText(/Chọn Hồ Sơ \/ CV Đã Lưu Của Bạn/i)).toBeInTheDocument();
    expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
    expect(screen.getByText('Tran Van B')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();

    const selectBtn = screen.getByRole('button', { name: /Dùng hồ sơ này/i });
    fireEvent.click(selectBtn);

    expect(mockSelect).toHaveBeenCalledWith(mockProfiles[0]);
    expect(mockClose).toHaveBeenCalled();
  });

  it('renders empty state when no profiles exist', () => {
    const mockSelect = vi.fn();
    const mockClose = vi.fn();
    const mockUploadNew = vi.fn();

    render(
      <ExistingProfilesModal
        isOpen={true}
        onClose={mockClose}
        profiles={[]}
        isLoading={false}
        onSelectProfile={mockSelect}
        onUploadNew={mockUploadNew}
      />,
    );

    expect(screen.getByText(/Chưa có hồ sơ nào được lưu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tải Lên CV Ngay/i })).toBeInTheDocument();
  });
});
