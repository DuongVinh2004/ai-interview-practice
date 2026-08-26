import { DesignEvaluationDto } from '@ai-interview/contracts';
import { Award, Sparkles, Layers } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';

interface DesignEvaluationReportProps {
  evaluation: DesignEvaluationDto;
}

export function DesignEvaluationReport({ evaluation }: DesignEvaluationReportProps) {
  const dimensions = [
    {
      name: 'Requirements & Scope Formulation',
      score: evaluation.requirementsScore ?? 8.0,
      weight: '15%',
      color: 'bg-indigo-500',
    },
    {
      name: 'High-Level Architectural Topology',
      score: evaluation.highLevelScore ?? 8.5,
      weight: '25%',
      color: 'bg-emerald-500',
    },
    {
      name: 'Component Deep-Dive & Services',
      score: evaluation.componentDetailScore ?? 8.0,
      weight: '20%',
      color: 'bg-purple-500',
    },
    {
      name: 'Scalability, Latency & Resilience',
      score: evaluation.scalabilityScore ?? 8.5,
      weight: '20%',
      color: 'bg-amber-500',
    },
    {
      name: 'Data Modeling & Storage Strategy',
      score: evaluation.dataModelScore ?? 8.0,
      weight: '20%',
      color: 'bg-sky-500',
    },
  ];

  return (
    <Card className="border-emerald-200 shadow-md" data-testid="design-evaluation-report">
      <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-600 text-white">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-emerald-950 text-base">
              System Design Rubric Evaluation
            </CardTitle>
            <span className="text-xs text-slate-500">5-Dimension Multimodal Vision Assessment</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-emerald-600 text-white px-3.5 py-1.5 rounded-full font-bold text-base shadow-sm">
          <span>{evaluation.overallScore.toFixed(1)}</span>
          <span className="text-emerald-200 text-xs">/ 10</span>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* 5 Dimension Progress Bars */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
            Rubric Dimension Breakdown
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dimensions.map(dim => (
              <div
                key={dim.name}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{dim.name}</span>
                  <span className="font-bold text-slate-900">
                    {dim.score.toFixed(1)}{' '}
                    <span className="text-[10px] text-slate-400 font-normal">({dim.weight})</span>
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${dim.color}`}
                    style={{ width: `${(dim.score / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Feedback */}
        {evaluation.feedback && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Interviewer Summary & Recommendations
            </span>
            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
              {evaluation.feedback}
            </p>
          </div>
        )}

        {/* Detected Components List */}
        {evaluation.detectedComponents && evaluation.detectedComponents.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              Identified Architecture Components
            </span>
            <div className="flex flex-wrap gap-1.5">
              {evaluation.detectedComponents.map((comp, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium"
                >
                  ✓ {comp}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
