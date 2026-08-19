import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Textarea } from '../components/ui/Textarea';
import { Alert } from '../components/ui/Alert';

describe('Interview Room Components', () => {
  it('renders Textarea with character limit counter', () => {
    render(
      <Textarea
        label="Candidate Answer"
        maxChars={5000}
        currentChars={150}
        placeholder="Type here..."
      />,
    );

    expect(screen.getByText(/150 \/ 5000 characters/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type here.../i)).toBeInTheDocument();
  });

  it('renders Alert component with proper variant', () => {
    render(
      <Alert variant="error" title="Submission Error">
        Answer text too short
      </Alert>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/submission error/i)).toBeInTheDocument();
    expect(screen.getByText(/answer text too short/i)).toBeInTheDocument();
  });
});
