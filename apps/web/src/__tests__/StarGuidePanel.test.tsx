import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StarGuidePanel } from '../components/interview/StarGuidePanel';

describe('StarGuidePanel Component (F007)', () => {
  it('renders all 4 STAR dimensions with bilingual guidance', () => {
    render(<StarGuidePanel currentStage="action" />);

    expect(screen.getByTestId('star-guide-panel')).toBeInTheDocument();
    expect(screen.getByText(/Situation \(Bối cảnh\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Task \(Nhiệm vụ\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Action \(Hành động\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Result \(Kết quả\)/i)).toBeInTheDocument();
  });
});
