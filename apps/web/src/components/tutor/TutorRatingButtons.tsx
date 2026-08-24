import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';

interface TutorRatingButtonsProps {
  onRate: (rating: 'UP' | 'DOWN', feedback?: string) => Promise<any>;
}

export const TutorRatingButtons: React.FC<TutorRatingButtonsProps> = ({ onRate }) => {
  const [rated, setRated] = useState<'UP' | 'DOWN' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRate = async (type: 'UP' | 'DOWN') => {
    if (rated || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onRate(type);
      setRated(type);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (rated) {
    return (
      <div className="flex items-center space-x-1.5 text-xs text-emerald-600 font-medium py-1">
        <Check className="w-3.5 h-3.5" />
        <span>Cảm ơn đánh giá của bạn!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-xs text-slate-500 py-1" data-testid="tutor-rating-buttons">
      <span>Đánh giá câu trả lời của AI Tutor:</span>
      <button
        type="button"
        onClick={() => handleRate('UP')}
        disabled={isSubmitting}
        className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-emerald-600 transition-colors"
        title="Hữu ích"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleRate('DOWN')}
        disabled={isSubmitting}
        className="p-1 rounded-md hover:bg-slate-100 text-slate-500 hover:text-rose-600 transition-colors"
        title="Chưa hữu ích"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
