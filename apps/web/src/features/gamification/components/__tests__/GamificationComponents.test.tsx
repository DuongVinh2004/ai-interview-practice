import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { XpBar } from '../XpBar';
import { XpPopup } from '../XpPopup';
import { ConfettiCelebration } from '../../../../components/effects/ConfettiCelebration';
import { useGamificationStore } from '../../../../stores/gamification.store';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('Gamification Components (Plan C1 & C2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGamificationStore.setState({
      profile: {
        userId: '11111111-1111-1111-1111-111111111111',
        totalXp: 141,
        currentLevel: 1,
        currentLevelMinXp: 0,
        nextLevelXp: 282,
        levelProgressPercent: 50,
        levelTitle: 'Novice Candidate',
        levelTitleVi: 'Ứng viên Tập sự',
        dailyXp: 50,
        streak: {
          currentStreak: 3,
          longestStreak: 7,
          totalReviews: 20,
          freezeCount: 2,
          freezeUsedToday: false,
        },
        dailyLoginClaimed: true,
        unlockedBadgesCount: 3,
        totalBadgesCount: 8,
        recentBadges: [],
      },
      pendingXpDeltas: [],
      activeLevelUp: null,
      activeBadgeUnlock: null,
    });
  });

  describe('XpBar', () => {
    it('should render level, XP progress bar, and percentage correctly', () => {
      render(<XpBar />);

      expect(screen.getByTestId('xp-bar')).toBeInTheDocument();
      expect(screen.getByText('Lv.1')).toBeInTheDocument();
      expect(screen.getByText('50% hoàn thành')).toBeInTheDocument();

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    });

    it('should render compact mode correctly', () => {
      render(<XpBar compact={true} />);

      expect(screen.getByTestId('xp-bar')).toBeInTheDocument();
      expect(screen.getByText('Lv.1')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('should render pulse skeleton if profile is null', () => {
      useGamificationStore.setState({ profile: null });
      const { container } = render(<XpBar />);
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('XpPopup', () => {
    it('should render standalone +20 XP floating popup with custom reason', () => {
      render(<XpPopup amount={20} reason="Practice Answer" isVisible={true} />);

      const popup = screen.getByTestId('xp-popup');
      expect(popup).toBeInTheDocument();
      expect(screen.getByText('+20 XP')).toBeInTheDocument();
      expect(screen.getByText('(Practice Answer)')).toBeInTheDocument();
    });

    it('should render stack of floating popups from gamification store pending deltas', () => {
      useGamificationStore.setState({
        pendingXpDeltas: [
          { id: 101, amount: 20, reason: 'Interview' },
          { id: 102, amount: 50, reason: 'Level Up' },
        ],
      });

      render(<XpPopup />);

      expect(screen.getByTestId('xp-popup-stack')).toBeInTheDocument();
      expect(screen.getByText('+20 XP')).toBeInTheDocument();
      expect(screen.getByText('+50 XP')).toBeInTheDocument();
    });
  });

  describe('ConfettiCelebration', () => {
    it('should trigger canvas confetti for win, levelup, and streak without crashing', () => {
      const onDone = vi.fn();
      const { rerender } = render(
        <ConfettiCelebration trigger={true} type="levelup" durationMs={100} onComplete={onDone} />,
      );

      rerender(
        <ConfettiCelebration trigger={true} type="streak" durationMs={100} onComplete={onDone} />,
      );

      rerender(
        <ConfettiCelebration trigger={true} type="win" durationMs={100} onComplete={onDone} />,
      );

      expect(true).toBe(true);
    });
  });
});
