import React from 'react';
import { AiCodeReview } from '@ai-interview/contracts';
import { Sparkles, Activity, Layers, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface AiCodeReviewPanelProps {
  review?: AiCodeReview | null;
}

export const AiCodeReviewPanel: React.FC<AiCodeReviewPanelProps> = ({ review }) => {
  if (!review) return null;

  return (
    <Card
      className="bg-slate-900 border-slate-700 text-slate-100 shadow-xl"
      data-testid="ai-code-review-panel"
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">
            AI Code Assessment & Complexity Analysis
          </h3>
        </div>
        <Badge variant={review.codeQualityScore >= 7 ? 'success' : 'warning'}>
          Score: {review.codeQualityScore}/10
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
            <Activity className="w-4 h-4 text-sky-400" />
            <span>Time Complexity (Big O)</span>
          </div>
          <div className="text-lg font-bold font-mono text-sky-300">{review.timeComplexity}</div>
        </div>

        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
          <div className="flex items-center space-x-1.5 text-xs text-slate-400 mb-1">
            <Layers className="w-4 h-4 text-purple-400" />
            <span>Space Complexity (Auxiliary)</span>
          </div>
          <div className="text-lg font-bold font-mono text-purple-300">
            {review.spaceComplexity}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-300 leading-relaxed font-sans">
        {review.complexityAnalysis}
      </p>

      {/* Clean Code Feedback */}
      {review.cleanCodeFeedback && review.cleanCodeFeedback.length > 0 && (
        <div className="mt-4 space-y-1.5">
          <div className="text-xs font-semibold text-slate-400">Clean Code Recommendations:</div>
          <ul className="space-y-1 text-xs text-slate-300">
            {review.cleanCodeFeedback.map((fb, idx) => (
              <li key={idx} className="flex items-start space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <span>{fb}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Edge Cases Identified */}
      {review.edgeCasesIdentified && review.edgeCasesIdentified.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="text-xs font-semibold text-slate-400">
            Key Boundary Conditions Tested:
          </div>
          <ul className="space-y-1 text-xs text-slate-300">
            {review.edgeCasesIdentified.map((ec, idx) => (
              <li key={idx} className="flex items-start space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                <span>{ec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
