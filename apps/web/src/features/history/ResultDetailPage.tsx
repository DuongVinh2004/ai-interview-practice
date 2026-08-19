import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { formatScore } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Award, ArrowLeft, BookOpen, Search, RotateCw } from 'lucide-react';

export function ResultDetailPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: result,
    isLoading,
    refetch,
  } = useQuery<any>({
    queryKey: ['interview-result', sessionId],
    queryFn: () => apiClient(`/interviews/${sessionId}/result`),
    enabled: !!sessionId,
  });

  const handleRegenerateLp = async () => {
    if (!sessionId) return;
    await apiClient(`/interviews/${sessionId}/learning-path/regenerate`, { method: 'POST' });
    refetch();
  };

  if (isLoading || !result) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading interview result report...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back button & Title */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/history')} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to History</span>
        </Button>
        <Badge variant="success">Completed</Badge>
      </div>

      {/* Header Score Overview */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                Final Evaluation Report
              </span>
              <h1 className="text-2xl font-bold mt-1">
                {result.jobRole?.name} ({result.seniorityLevel?.name})
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                Tech Stack: {result.technologies?.map((t: any) => t.name).join(', ')}
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700">
              <Award className="h-10 w-10 text-emerald-400" />
              <div>
                <span className="text-xs text-slate-400 block">Overall Score</span>
                <span className="text-3xl font-extrabold text-emerald-400">
                  {formatScore(result.overallScore)}
                  <span className="text-sm text-slate-400 font-normal"> / 10</span>
                </span>
              </div>
            </div>
          </div>

          {/* Rubric Averages */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-700/60 text-center">
            <div>
              <span className="text-xs text-slate-400 block">Technical Accuracy</span>
              <span className="text-lg font-bold text-white">
                {formatScore(result.rubricAverages?.technicalAccuracy)}/10
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Depth & Precision</span>
              <span className="text-lg font-bold text-white">
                {formatScore(result.rubricAverages?.depth)}/10
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block">Clarity of Thought</span>
              <span className="text-lg font-bold text-white">
                {formatScore(result.rubricAverages?.clarity)}/10
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Learning Path */}
      <Card className="border-emerald-200">
        <CardHeader className="bg-emerald-50/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-600" />
            <CardTitle>Personalized Learning Roadmap</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerateLp}
            className="gap-1.5 text-xs text-slate-600"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Regenerate</span>
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {result.learningPath ? (
            <>
              {result.learningPath.summary && (
                <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {result.learningPath.summary}
                </p>
              )}

              <div className="space-y-3">
                {result.learningPath.items?.map((item: any, idx: number) => (
                  <div
                    key={item.id || idx}
                    className="p-4 rounded-lg border border-slate-200 bg-white space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-slate-900">{item.topic}</h4>
                      <Badge
                        variant={
                          item.priority === 'HIGH'
                            ? 'danger'
                            : item.priority === 'MEDIUM'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {item.priority} PRIORITY
                      </Badge>
                    </div>
                    <p className="text-xs text-rose-700 font-medium">Gap: {item.gap}</p>
                    <p className="text-xs text-slate-600">{item.recommendedAction}</p>

                    {item.searchKeywords?.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <Search className="h-3 w-3 text-slate-400" />
                        <span className="text-[10px] text-slate-400 font-medium">Keywords:</span>
                        {item.searchKeywords.map((kw: string, kidx: number) => (
                          <span
                            key={kidx}
                            className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Learning path is generating in the background...
            </p>
          )}
        </CardContent>
      </Card>

      {/* 5 Turns Review */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Questions & Answers Review</h3>
        {result.turns?.map((turn: any) => (
          <Card key={turn.turnNumber}>
            <CardHeader className="bg-slate-50/70 py-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-700">
                  Question #{turn.turnNumber}
                </span>
                {turn.answer?.evaluation && (
                  <span className="font-bold text-xs text-emerald-700">
                    Score: {formatScore(turn.answer.evaluation.score)}/10
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium text-slate-900">{turn.question?.content}</p>
              {turn.answer && (
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="font-semibold text-slate-700 block mb-1">Your Answer:</span>
                  {turn.answer.content}
                </div>
              )}
              {turn.answer?.evaluation && (
                <div className="text-xs text-slate-700 pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900 block mb-0.5">Feedback:</span>
                  {turn.answer.evaluation.conciseFeedback}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
