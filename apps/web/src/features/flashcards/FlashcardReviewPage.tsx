import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { FlashcardItem } from '../../components/flashcards/FlashcardItem';
import { useFlashcards } from '../../hooks/useFlashcards';
import { FSRSRating } from '@ai-interview/contracts';

export function FlashcardReviewPage() {
  const navigate = useNavigate();
  const { dueCards, isLoadingDue, reviewCard, isReviewingCard } = useFlashcards();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    setStartTime(Date.now());
    setIsFlipped(false);
  }, [currentIndex]);

  const currentCard = dueCards[currentIndex];
  const isFinished = !isLoadingDue && (!currentCard || currentIndex >= dueCards.length);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (isFlipped && !isReviewingCard) {
        if (e.key === '1') handleRating(FSRSRating.AGAIN);
        if (e.key === '2') handleRating(FSRSRating.HARD);
        if (e.key === '3') handleRating(FSRSRating.GOOD);
        if (e.key === '4') handleRating(FSRSRating.EASY);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, isReviewingCard, isFinished, currentIndex, currentCard]);

  const handleRating = async (rating: FSRSRating) => {
    if (!currentCard || isReviewingCard) return;

    const durationMs = Date.now() - startTime;
    await reviewCard({ cardId: currentCard.id, rating, durationMs });
    setCompletedCount(prev => prev + 1);
    setCurrentIndex(prev => prev + 1);
  };

  if (isLoadingDue) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Đang tải thẻ cần ôn tập...</p>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6" data-testid="review-finished">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900">
            Tuyệt vời! Bạn đã hoàn thành buổi ôn tập hôm nay
          </h2>
          <p className="text-sm text-slate-600">
            Đã hoàn thành <strong className="text-emerald-700">{completedCount}</strong> lượt ôn tập. Thuật toán FSRS v4 đã tối ưu lại thời điểm ôn tiếp theo cho bộ nhớ dài hạn của bạn.
          </p>
        </div>

        <div className="pt-4 flex justify-center space-x-3">
          <Button variant="outline" onClick={() => navigate('/flashcards')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span>Quay lại Bộ thẻ</span>
          </Button>
          <Button onClick={() => navigate('/dashboard')}>
            <span>Về Bảng điều khiển</span>
          </Button>
        </div>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex) / dueCards.length) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 sm:p-6" data-testid="flashcard-review-page">
      {/* Top Controls */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/flashcards')}
          className="flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span>Thoát buổi học</span>
        </button>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-700">
            Thẻ {currentIndex + 1} / {dueCards.length}
          </span>
          <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Flip Card */}
      <FlashcardItem
        front={currentCard.frontContent}
        back={currentCard.backContent}
        type={currentCard.type}
        isFlipped={isFlipped}
        onFlip={() => setIsFlipped(!isFlipped)}
      />

      {/* Rating Buttons Bar */}
      {isFlipped ? (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Rating 1: Again */}
            <button
              type="button"
              onClick={() => handleRating(FSRSRating.AGAIN)}
              disabled={isReviewingCard}
              className="p-3 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all shadow-xs"
            >
              <span>1. Chưa nhớ (Again)</span>
              <span className="text-[10px] text-rose-600 font-normal mt-0.5">&lt; 1 ngày</span>
            </button>

            {/* Rating 2: Hard */}
            <button
              type="button"
              onClick={() => handleRating(FSRSRating.HARD)}
              disabled={isReviewingCard}
              className="p-3 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all shadow-xs"
            >
              <span>2. Khó (Hard)</span>
              <span className="text-[10px] text-amber-600 font-normal mt-0.5">~1-2 ngày</span>
            </button>

            {/* Rating 3: Good */}
            <button
              type="button"
              onClick={() => handleRating(FSRSRating.GOOD)}
              disabled={isReviewingCard}
              className="p-3 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all shadow-xs ring-1 ring-emerald-400"
            >
              <span>3. Tốt (Good)</span>
              <span className="text-[10px] text-emerald-600 font-normal mt-0.5">~3-5 ngày</span>
            </button>

            {/* Rating 4: Easy */}
            <button
              type="button"
              onClick={() => handleRating(FSRSRating.EASY)}
              disabled={isReviewingCard}
              className="p-3 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-800 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all shadow-xs"
            >
              <span>4. Dễ (Easy)</span>
              <span className="text-[10px] text-sky-600 font-normal mt-0.5">&gt; 7 ngày</span>
            </button>
          </div>

          <p className="text-center text-[11px] text-slate-400">
            Phím tắt: Nhấn <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border">1</kbd>, <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border">2</kbd>, <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border">3</kbd>, <kbd className="font-mono bg-slate-100 px-1 py-0.5 rounded border">4</kbd> trên bàn phím
          </p>
        </div>
      ) : (
        <div className="flex justify-center">
          <Button size="lg" onClick={() => setIsFlipped(true)} className="w-full sm:w-auto px-8 shadow-sm">
            <span>Hiển thị Đáp án (Lật thẻ)</span>
          </Button>
        </div>
      )}
    </div>
  );
}
