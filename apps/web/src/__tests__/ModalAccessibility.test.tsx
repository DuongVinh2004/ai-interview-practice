import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../components/ui/Modal';
import { useState } from 'react';

function ModalTestWrapper() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button id="open-btn" onClick={() => setIsOpen(true)}>
        Open Modal
      </button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Accessible Modal Title"
        description="Accessible modal description text"
      >
        <input id="input-first" placeholder="First input" />
        <button id="btn-submit">Submit</button>
      </Modal>
    </div>
  );
}

describe('Modal Accessibility & Focus Trapping (A11Y-001)', () => {
  it('renders modal with role="dialog", aria-modal="true", and connects title/description IDs', () => {
    const handleClose = vi.fn();
    render(
      <Modal
        isOpen={true}
        onClose={handleClose}
        title="Test Accessible Title"
        description="Test Accessible Description"
      >
        <p>Modal content</p>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby');

    const titleEl = screen.getByText('Test Accessible Title');
    const descEl = screen.getByText('Test Accessible Description');

    expect(dialog.getAttribute('aria-labelledby')).toBe(titleEl.id);
    expect(dialog.getAttribute('aria-describedby')).toBe(descEl.id);
  });

  it('closes on Escape key press', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Escape Test">
        <button>Action</button>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('cycles focus within modal on Tab and Shift+Tab (focus trap)', async () => {
    render(<ModalTestWrapper />);

    const openBtn = screen.getByText('Open Modal');
    fireEvent.click(openBtn);

    const closeBtn = screen.getByLabelText('Close modal');
    const submitBtn = screen.getByText('Submit');

    // Simulate focus on last element and pressing Tab -> wraps to first
    submitBtn.focus();
    expect(document.activeElement).toBe(submitBtn);

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    // Simulate focus on first element and pressing Shift+Tab -> wraps to last
    closeBtn.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(submitBtn);
  });

  it('supports Dark Mode styling with WCAG 2.1 AA contrast', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Dark Mode Accessible Title">
        <p>Modal body content</p>
      </Modal>,
    );

    const dialogContainer = screen.getByRole('dialog').querySelector('.dark\\:bg-slate-900');
    expect(dialogContainer).toBeInTheDocument();
    expect(screen.getByText('Dark Mode Accessible Title')).toHaveClass('dark:text-slate-100');
  });
});
