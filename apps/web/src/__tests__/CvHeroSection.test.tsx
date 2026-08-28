import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CvHeroSection, ExtractedProfileData } from '../components/setup/CvHeroSection';

describe('CvHeroSection Component', () => {
  const mockUploadCv = vi.fn();
  const mockOpenJd = vi.fn();
  const mockSelectExisting = vi.fn();
  const mockSkipCv = vi.fn();
  const mockResetCv = vi.fn();
  const mockProceedToPresets = vi.fn();

  const mockExtracted: ExtractedProfileData = {
    targetRole: 'Backend Engineer',
    seniorityLevel: 'Mid-Level',
    fullName: 'Nguyen Van A',
    skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Docker'],
    matchedTechnologyIds: ['t1', 't2'],
  };

  it('renders initial empty state with upload, JD and skip buttons', () => {
    render(
      <CvHeroSection
        extractedProfile={null}
        isParsing={false}
        onUploadCvFile={mockUploadCv}
        onOpenJdInput={mockOpenJd}
        onSelectExistingProfile={mockSelectExisting}
        onSkipCv={mockSkipCv}
        onResetCv={mockResetCv}
      />,
    );

    expect(screen.getByText(/Hồ Sơ Cho Buổi Phỏng Vấn/i)).toBeInTheDocument();
    expect(screen.getByText(/Tải Lên CV Của Bạn/i)).toBeInTheDocument();
    expect(screen.getByText(/Nhập JD Công Việc/i)).toBeInTheDocument();
    expect(screen.getByText(/Tiếp tục không dùng CV/i)).toBeInTheDocument();
  });

  it('renders loading spinner when isParsing is true', () => {
    render(
      <CvHeroSection
        extractedProfile={null}
        isParsing={true}
        onUploadCvFile={mockUploadCv}
        onOpenJdInput={mockOpenJd}
        onSelectExistingProfile={mockSelectExisting}
        onSkipCv={mockSkipCv}
        onResetCv={mockResetCv}
      />,
    );

    expect(screen.getByText(/AI đang phân tích và trích xuất hồ sơ/i)).toBeInTheDocument();
  });

  it('renders extracted profile card with role, level, and skills', () => {
    render(
      <CvHeroSection
        extractedProfile={mockExtracted}
        isParsing={false}
        onUploadCvFile={mockUploadCv}
        onOpenJdInput={mockOpenJd}
        onSelectExistingProfile={mockSelectExisting}
        onSkipCv={mockSkipCv}
        onResetCv={mockResetCv}
        onProceedToPresets={mockProceedToPresets}
      />,
    );

    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Mid-Level')).toBeInTheDocument();
    expect(screen.getByText('Java')).toBeInTheDocument();
    expect(screen.getByText('Spring Boot')).toBeInTheDocument();

    const proceedBtn = screen.getByRole('button', { name: /Tiếp tục bước 2/i });
    fireEvent.click(proceedBtn);
    expect(mockProceedToPresets).toHaveBeenCalled();
  });

  it('triggers onOpenJdInput when clicking Nhập JD Công Việc button', () => {
    render(
      <CvHeroSection
        extractedProfile={null}
        isParsing={false}
        onUploadCvFile={mockUploadCv}
        onOpenJdInput={mockOpenJd}
        onSelectExistingProfile={mockSelectExisting}
        onSkipCv={mockSkipCv}
        onResetCv={mockResetCv}
      />,
    );

    const jdBtn = screen.getByRole('button', { name: /Nhập JD Công Việc/i });
    fireEvent.click(jdBtn);
    expect(mockOpenJd).toHaveBeenCalledTimes(1);
  });

  it('triggers onSelectExistingProfile when clicking Dùng Hồ Sơ Đã Có button', () => {
    render(
      <CvHeroSection
        extractedProfile={null}
        isParsing={false}
        onUploadCvFile={mockUploadCv}
        onOpenJdInput={mockOpenJd}
        onSelectExistingProfile={mockSelectExisting}
        onSkipCv={mockSkipCv}
        onResetCv={mockResetCv}
      />,
    );

    const existingBtn = screen.getByRole('button', { name: /Dùng Hồ Sơ Đã Có/i });
    fireEvent.click(existingBtn);
    expect(mockSelectExisting).toHaveBeenCalledTimes(1);
  });

  it('triggers onSkipCv when clicking skip link', () => {
    render(
      <CvHeroSection
        extractedProfile={null}
        isParsing={false}
        onUploadCvFile={mockUploadCv}
        onOpenJdInput={mockOpenJd}
        onSelectExistingProfile={mockSelectExisting}
        onSkipCv={mockSkipCv}
        onResetCv={mockResetCv}
      />,
    );

    const skipBtn = screen.getByText(/Tiếp tục không dùng CV/i);
    fireEvent.click(skipBtn);
    expect(mockSkipCv).toHaveBeenCalledTimes(1);
  });
});
