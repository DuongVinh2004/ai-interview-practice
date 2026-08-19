import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui/Button';

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Submit Answer</Button>);
    expect(screen.getByRole('button', { name: /submit answer/i })).toBeInTheDocument();
  });

  it('shows loading spinner and is disabled when isLoading is true', () => {
    render(<Button isLoading>Submit Answer</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
