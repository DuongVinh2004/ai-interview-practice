import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { Select } from '../components/ui/Select';
import { ProgressBar } from '../components/ui/ProgressBar';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Tabs } from '../components/ui/Tabs';
import { ConfirmationDialog } from '../components/ui/ConfirmationDialog';
import { Modal } from '../components/ui/Modal';
import { Navbar } from '../components/layout/Navbar';

describe('Design System & Shared Components (Phase 1)', () => {
  it('renders Skeleton component with different variants', () => {
    const { container } = render(<Skeleton variant="card" width="100%" height={100} />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('renders ErrorState with title, message, and handles retry', () => {
    const handleRetry = vi.fn();
    render(
      <ErrorState
        title="Failed to load question"
        message="Network timeout occurred."
        onRetry={handleRetry}
        retryLabel="Retry question"
      />,
    );

    expect(screen.getByText('Failed to load question')).toBeInTheDocument();
    expect(screen.getByText('Network timeout occurred.')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry question/i });
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders Select component with options and error message', () => {
    render(
      <Select
        label="Select Seniority"
        error="Seniority is required"
        options={[
          { value: 'junior', label: 'Junior Engineer' },
          { value: 'senior', label: 'Senior Engineer' },
        ]}
      />,
    );

    expect(screen.getByLabelText('Select Seniority')).toBeInTheDocument();
    expect(screen.getByText('Seniority is required')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders ProgressBar with accessible ARIA properties', () => {
    render(<ProgressBar value={3} max={5} label="Turn Progress" showPercentage />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '3');
    expect(progressbar).toHaveAttribute('aria-valuemax', '5');
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('renders Breadcrumbs navigation correctly', () => {
    render(
      <MemoryRouter>
        <Breadcrumbs
          items={[
            { label: 'History', href: '/history' },
            { label: 'Session #101' },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Session #101')).toHaveAttribute('aria-current', 'page');
  });

  it('renders Tabs and handles tab switching with keyboard navigation', () => {
    const handleTabChange = vi.fn();
    render(
      <Tabs
        tabs={[
          { id: 'standard', label: 'Standard Mode' },
          { id: 'remediation', label: 'Remediation Mode' },
        ]}
        activeTab="standard"
        onChange={handleTabChange}
      />,
    );

    const standardTab = screen.getByRole('tab', { name: /standard mode/i });
    const remediationTab = screen.getByRole('tab', { name: /remediation mode/i });

    expect(standardTab).toHaveAttribute('aria-selected', 'true');
    expect(remediationTab).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(remediationTab);
    expect(handleTabChange).toHaveBeenCalledWith('remediation');
  });

  it('handles ConfirmationDialog open and confirm actions', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <ConfirmationDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Leave Interview Session?"
        message="Your unsaved answers will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
      />,
    );

    expect(screen.getByText('Leave Interview Session?')).toBeInTheDocument();
    expect(screen.getByText('Your unsaved answers will be lost.')).toBeInTheDocument();

    const leaveBtn = screen.getByRole('button', { name: /leave/i });
    fireEvent.click(leaveBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);

    const stayBtn = screen.getByRole('button', { name: /stay/i });
    fireEvent.click(stayBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('closes Modal on Escape key press', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <p>Modal content</p>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders Navbar brand and main candidate navigation links', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByText(/(AI Interview Practice|Luyện Phỏng Vấn AI)/i)).toBeInTheDocument();
  });
});
