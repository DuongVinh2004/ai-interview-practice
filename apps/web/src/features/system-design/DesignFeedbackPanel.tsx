import { VisionAnalysisResultDto } from '@ai-interview/contracts';
import { Sparkles, CheckCircle2, AlertTriangle, HelpCircle, Eye } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';

interface DesignFeedbackPanelProps {
  analysis?: VisionAnalysisResultDto | null;
  isAnalyzing: boolean;
  onTriggerAnalysis: () => void;
}

export function DesignFeedbackPanel({
  analysis,
  isAnalyzing,
  onTriggerAnalysis,
}: DesignFeedbackPanelProps) {
  return (
    <div
      className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden"
      data-testid="design-feedback-panel"
    >
      {/* Header */}
      <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            AI Co-Pilot Vision Feedback
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onTriggerAnalysis}
          isLoading={isAnalyzing}
          className="gap-1.5 text-xs py-1 h-7 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Analyze Canvas</span>
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[480px]">
        {isAnalyzing ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <Spinner size="md" />
            <p className="text-xs font-semibold text-indigo-900">
              Multimodal Vision AI analyzing architectural diagram...
            </p>
            <span className="text-[11px] text-slate-400">
              Evaluating component topologies, bottleneck risk, and data sharding.
            </span>
          </div>
        ) : analysis ? (
          <div className="space-y-4 text-xs">
            {/* Detected Style */}
            <div className="p-3 rounded-lg bg-indigo-50/60 border border-indigo-100">
              <span className="font-bold text-indigo-950 block mb-1">Architecture Style</span>
              <p className="text-indigo-900 font-medium">{analysis.architectureStyle}</p>
              <p className="text-slate-600 mt-1 text-[11px]">{analysis.summary}</p>
            </div>

            {/* Detected Components Badges */}
            <div>
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-1.5">
                Detected Components ({analysis.detectedComponents.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {analysis.detectedComponents.map((comp, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium text-[11px]"
                  >
                    {comp}
                  </span>
                ))}
              </div>
            </div>

            {/* Strengths */}
            <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200 space-y-1.5">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Architectural Strengths
              </span>
              <ul className="space-y-1 list-disc list-inside text-slate-700 text-[11px]">
                {analysis.strengths.map((str, idx) => (
                  <li key={idx}>{str}</li>
                ))}
              </ul>
            </div>

            {/* Bottlenecks */}
            <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200 space-y-1.5">
              <span className="font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Potential Bottlenecks & SPOFs
              </span>
              <ul className="space-y-1 list-disc list-inside text-slate-700 text-[11px]">
                {analysis.potentialBottlenecks.map((bot, idx) => (
                  <li key={idx}>{bot}</li>
                ))}
              </ul>
            </div>

            {/* Realtime Suggestions / Probing Questions */}
            <div className="p-3 rounded-lg bg-purple-50/40 border border-purple-200 space-y-1.5">
              <span className="font-bold text-purple-900 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
                Interviewer Probing Questions
              </span>
              <ul className="space-y-1 text-slate-700 text-[11px]">
                {analysis.realtimeSuggestions.map((sug, idx) => (
                  <li key={idx} className="p-1.5 bg-white rounded border border-purple-100">
                    “{sug}”
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-slate-400 space-y-2">
            <Eye className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-semibold text-slate-600">Canvas not analyzed yet</p>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
              Place components and draw connections on the canvas, then click "Analyze Canvas" for
              instant multimodal feedback.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
