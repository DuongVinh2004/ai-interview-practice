import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PacingTimer } from '../components/interview/PacingTimer';
import { RubricBreakdown } from '../components/interview/RubricBreakdown';
import { useI18nStore } from '../stores/i18n.store';

describe('Epic 3 UX & Bilingual Components', () => {
  it('renders PacingTimer with initial 00:00 counter', () => {
    render(<PacingTimer isActive={false} turnNumber={1} />);
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });

  it('renders RubricBreakdown with 3 weighted dimensions', () => {
    render(
      <RubricBreakdown
        scores={{
          technicalAccuracy: 8.5,
          depth: 7.8,
          clarity: 9.0,
        }}
      />,
    );

    expect(screen.getByText('8.5')).toBeInTheDocument();
    expect(screen.getByText('7.8')).toBeInTheDocument();
    expect(screen.getByText('9.0')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getAllByText('30%').length).toBe(2);
  });

  it('switches languages in useI18nStore seamlessly', () => {
    const { setLanguage } = useI18nStore.getState();

    setLanguage('en');
    expect(useI18nStore.getState().language).toBe('en');
    expect(useI18nStore.getState().t.nav.newInterview).toBe('New Interview');

    setLanguage('vi');
    expect(useI18nStore.getState().language).toBe('vi');
    expect(useI18nStore.getState().t.nav.newInterview).toBe('Phỏng vấn mới');
  });
});
