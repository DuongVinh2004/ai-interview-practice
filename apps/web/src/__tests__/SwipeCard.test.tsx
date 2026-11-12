import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwipeCard, evaluateSwipeDrag } from '../components/mobile/SwipeCard';
import { CardType } from '@ai-interview/contracts';

describe('SwipeCard Component (Mobile Flashcard Experience)', () => {
  it('renders front content and card metadata correctly', () => {
    const onFlip = vi.fn();
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();

    render(
      <SwipeCard
        front="What is idempotency in REST APIs?"
        back="An operation can be applied multiple times without changing the result beyond the initial application."
        type={CardType.SCENARIO}
        isFlipped={false}
        onFlip={onFlip}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={onSwipeLeft}
      />,
    );

    expect(screen.getByTestId('swipe-card')).toBeInTheDocument();
    expect(screen.getByText('What is idempotency in REST APIs?')).toBeInTheDocument();
    expect(screen.getByText(CardType.SCENARIO)).toBeInTheDocument();
  });

  it('triggers onFlip when card is clicked', () => {
    const onFlip = vi.fn();
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();

    render(
      <SwipeCard
        front="What is ACID?"
        back="Atomicity, Consistency, Isolation, Durability"
        type={CardType.CONCEPT}
        isFlipped={false}
        onFlip={onFlip}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={onSwipeLeft}
      />,
    );

    const card = screen.getByTestId('swipe-card');
    fireEvent.click(card);
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it('renders back content when isFlipped is true', () => {
    const onFlip = vi.fn();
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();

    render(
      <SwipeCard
        front="What is ACID?"
        back="Atomicity, Consistency, Isolation, Durability"
        type={CardType.CONCEPT}
        isFlipped={true}
        onFlip={onFlip}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={onSwipeLeft}
      />,
    );

    expect(screen.getByText('Atomicity, Consistency, Isolation, Durability')).toBeInTheDocument();
  });

  it('triggers onSwipeRight when drag offset > 100px to the right', () => {
    const onFlip = vi.fn();
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();

    render(
      <SwipeCard
        front="What is CAP theorem?"
        back="Consistency, Availability, Partition tolerance"
        type={CardType.CONCEPT}
        isFlipped={false}
        onFlip={onFlip}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={onSwipeLeft}
      />,
    );

    const card = screen.getByTestId('swipe-card');
    fireEvent(card, new CustomEvent('drag-swipe', { detail: { offset: { x: 120 } } }));

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('triggers onSwipeLeft when drag offset < -100px to the left', () => {
    const onFlip = vi.fn();
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();

    render(
      <SwipeCard
        front="What is CAP theorem?"
        back="Consistency, Availability, Partition tolerance"
        type={CardType.CONCEPT}
        isFlipped={false}
        onFlip={onFlip}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={onSwipeLeft}
      />,
    );

    const card = screen.getByTestId('swipe-card');
    fireEvent(card, new CustomEvent('drag-swipe', { detail: { offset: { x: -120 } } }));

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('does NOT trigger swipe when drag offset is within threshold [-100px, 100px]', () => {
    const onFlip = vi.fn();
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();

    render(
      <SwipeCard
        front="What is CAP theorem?"
        back="Consistency, Availability, Partition tolerance"
        type={CardType.CONCEPT}
        isFlipped={false}
        onFlip={onFlip}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={onSwipeLeft}
      />,
    );

    const card = screen.getByTestId('swipe-card');
    fireEvent(card, new CustomEvent('drag-swipe', { detail: { offset: { x: 50 } } }));
    fireEvent(card, new CustomEvent('drag-swipe', { detail: { offset: { x: -50 } } }));

    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('supports touch swipe gestures on mobile screens', () => {
    const onFlip = vi.fn();
    const onSwipeRight = vi.fn();
    const onSwipeLeft = vi.fn();

    render(
      <SwipeCard
        front="What is Raft?"
        back="A consensus algorithm designed to be easy to understand."
        type={CardType.CONCEPT}
        isFlipped={false}
        onFlip={onFlip}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={onSwipeLeft}
      />,
    );

    const card = screen.getByTestId('swipe-card');
    fireEvent.touchStart(card, { touches: [{ clientX: 20 }] });
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 160 }] });

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('evaluates drag thresholds correctly via evaluateSwipeDrag helper', () => {
    const rightSpy = vi.fn();
    const leftSpy = vi.fn();

    expect(evaluateSwipeDrag(101, { onSwipeRight: rightSpy, onSwipeLeft: leftSpy })).toBe('right');
    expect(rightSpy).toHaveBeenCalledTimes(1);

    expect(evaluateSwipeDrag(-101, { onSwipeRight: rightSpy, onSwipeLeft: leftSpy })).toBe('left');
    expect(leftSpy).toHaveBeenCalledTimes(1);

    expect(evaluateSwipeDrag(100, { onSwipeRight: rightSpy, onSwipeLeft: leftSpy })).toBeNull();
    expect(evaluateSwipeDrag(-100, { onSwipeRight: rightSpy, onSwipeLeft: leftSpy })).toBeNull();
    expect(evaluateSwipeDrag(0, { onSwipeRight: rightSpy, onSwipeLeft: leftSpy })).toBeNull();
  });
});
