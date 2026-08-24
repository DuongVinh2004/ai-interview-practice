import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonacoCodeEditor } from '../components/code-editor/MonacoCodeEditor';

describe('MonacoCodeEditor Component (F002)', () => {
  it('renders language selector, reset button, run button, and submit button', () => {
    const handleLangChange = vi.fn();
    const handleCodeChange = vi.fn();
    const handleRun = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <MonacoCodeEditor
        language="javascript"
        onLanguageChange={handleLangChange}
        onCodeChange={handleCodeChange}
        onRunCode={handleRun}
        onSubmitCode={handleSubmit}
      />,
    );

    expect(screen.getByTestId('language-selector')).toBeInTheDocument();
    expect(screen.getByTestId('run-code-btn')).toBeInTheDocument();
    expect(screen.getByTestId('submit-code-btn')).toBeInTheDocument();
    expect(screen.getByTestId('code-textarea')).toBeInTheDocument();
  });

  it('triggers onLanguageChange and onCodeChange on user interactions', () => {
    const handleLangChange = vi.fn();
    const handleCodeChange = vi.fn();
    const handleRun = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <MonacoCodeEditor
        language="javascript"
        onLanguageChange={handleLangChange}
        onCodeChange={handleCodeChange}
        onRunCode={handleRun}
        onSubmitCode={handleSubmit}
      />,
    );

    const selector = screen.getByTestId('language-selector');
    fireEvent.change(selector, { target: { value: 'python' } });
    expect(handleLangChange).toHaveBeenCalledWith('python');

    const textarea = screen.getByTestId('code-textarea');
    fireEvent.change(textarea, { target: { value: 'def test(): return True' } });
    expect(handleCodeChange).toHaveBeenCalledWith('def test(): return True');

    const runBtn = screen.getByTestId('run-code-btn');
    fireEvent.click(runBtn);
    expect(handleRun).toHaveBeenCalled();

    const submitBtn = screen.getByTestId('submit-code-btn');
    fireEvent.click(submitBtn);
    expect(handleSubmit).toHaveBeenCalled();
  });
});
