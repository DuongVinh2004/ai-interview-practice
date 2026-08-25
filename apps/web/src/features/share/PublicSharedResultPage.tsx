import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { formatScore } from '../../lib/utils';
import { useI18nStore } from '../../stores/i18n.store';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { RubricBreakdown } from '../../components/interview/RubricBreakdown';
import { MentorFeedbackList } from '../../components/share/MentorFeedbackList';
import { Award, Globe, Printer, BookOpen, AlertCircle, User } from 'lucide-react';

export function PublicSharedResultPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useI18nStore();
  const [passcode, setPasscode] = useState('');
  const [submittedPasscode, setSubmittedPasscode] = useState('');

  const {
    data: publicReport,
    isLoading,
    error,
    refetch,
  } = useQuery<any>({
    queryKey: ['public-share-report', token, submittedPasscode],
    queryFn: () =>
      apiClient(
        `/public/share/${token}${submittedPasscode ? `?passcode=${encodeURIComponent(submittedPasscode)}` : ''}`,
      ),
    enabled: !!token,
    retry: false,
  });

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 mt-4">Loading shared interview assessment report...</p>
      </div>
    );
  }

  if (error || !publicReport) {
    const errorMsg = (error as any)?.message || 'Failed to load report';
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl w-fit mx-auto">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Link Unavailable or Expired</h2>
          <p className="text-xs text-slate-500">
            {errorMsg.includes('passcode') ? 'This report is protected by a passcode.' : errorMsg}
          </p>

          {errorMsg.includes('passcode') && (
            <form
              onSubmit={e => {
                e.preventDefault();
                setSubmittedPasscode(passcode);
              }}
              className="space-y-3 pt-2"
            >
              <input
                type="password"
                placeholder="Enter report passcode"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-center"
              />
              <Button type="submit" className="w-full" size="sm">
                Unlock Report
              </Button>
            </form>
          )}

          <div className="pt-2">
            <Link to="/">
              <Button variant="secondary" size="sm">
                Go to Homepage
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { session, candidate, mentorFeedback } = publicReport;

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Public Review Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold">{t.share.publicReviewBanner}</h1>
              <p className="text-xs text-emerald-100 mt-0.5">
                Verified Evaluation Artifact •{' '}
                {new Date(publicReport.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            className="gap-2 bg-white/90 hover:bg-white text-slate-900 border-none print:hidden shadow-sm"
          >
            <Printer className="h-4 w-4" />
            <span>{t.share.printPdf}</span>
          </Button>
        </div>

        {/* Candidate & Scorecard Header */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-md">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-left">
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5 justify-center md:justify-start">
                  <User className="h-3.5 w-3.5" />
                  <span>{candidate.fullName}</span>
                </span>
                <h2 className="text-2xl font-bold">
                  {session.jobRole.name} ({session.seniorityLevel.name})
                </h2>
                <div className="flex flex-wrap gap-1.5 justify-center md:justify-start pt-1">
                  {session.technologies.map((t: any) => (
                    <Badge
                      key={t.id}
                      variant="default"
                      className="bg-slate-800 text-slate-300 border-slate-700"
                    >
                      {t.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Overall Score */}
              <div className="flex flex-col items-center bg-slate-800/80 px-8 py-5 rounded-2xl border border-slate-700">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Overall Score
                </span>
                <span className="text-4xl font-extrabold font-mono text-emerald-400 mt-1">
                  {formatScore(session.overallScore)}
                </span>
                <span className="text-[11px] text-slate-400 mt-1">out of 10.0</span>
              </div>
            </div>

            {/* Rubric Averages */}
            {session.rubricAverages && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-slate-800">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-center">
                  <span className="text-xs text-slate-400">Technical Accuracy</span>
                  <p className="text-xl font-bold font-mono text-white mt-1">
                    {session.rubricAverages.technicalAccuracy.toFixed(1)} / 10
                  </p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-center">
                  <span className="text-xs text-slate-400">Depth & Trade-offs</span>
                  <p className="text-xl font-bold font-mono text-white mt-1">
                    {session.rubricAverages.depth.toFixed(1)} / 10
                  </p>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-center">
                  <span className="text-xs text-slate-400">Clarity & Communication</span>
                  <p className="text-xl font-bold font-mono text-white mt-1">
                    {session.rubricAverages.clarity.toFixed(1)} / 10
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Turn by Turn Question & Answer Breakdown */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="h-5 w-5 text-emerald-600" />
            <span>Detailed Turn Evaluations (5 Questions)</span>
          </h3>

          <div className="space-y-6">
            {session.turns.map((turn: any) => (
              <Card key={turn.turnNumber} className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <span className="bg-slate-900 text-white text-xs font-bold px-2.5 py-1 rounded-md font-mono">
                      Q{turn.turnNumber}
                    </span>
                    {turn.question?.keyFocus && (
                      <Badge variant="default" className="text-xs">
                        Focus: {turn.question.keyFocus}
                      </Badge>
                    )}
                  </div>
                  {turn.answer?.evaluation && (
                    <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                      <span className="text-xs text-emerald-700 font-medium">Score:</span>
                      <span className="text-sm font-bold font-mono text-emerald-800">
                        {formatScore(turn.answer.evaluation.score)}/10
                      </span>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Question */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Interview Question
                    </h4>
                    <p className="text-sm font-medium text-slate-900 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                      {turn.question?.content}
                    </p>
                  </div>

                  {/* Answer */}
                  {turn.answer && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Candidate Answer
                      </h4>
                      <p className="text-sm text-slate-800 leading-relaxed p-4 rounded-xl border border-slate-200 bg-white whitespace-pre-wrap">
                        {turn.answer.content}
                      </p>
                    </div>
                  )}

                  {/* Rubric Evaluation Breakdown */}
                  {turn.answer?.evaluation && (
                    <div className="pt-2">
                      <RubricBreakdown scores={turn.answer.evaluation.rubricScores} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Custom Learning Path */}
        {session.learningPath && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center gap-2 border-b border-slate-100 py-4">
              <BookOpen className="h-5 w-5 text-indigo-600" />
              <CardTitle className="text-base font-bold">Personalized Learning Roadmap</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-slate-600">{session.learningPath.summary}</p>
              <div className="space-y-3">
                {session.learningPath.items.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">{item.topic}</span>
                      <Badge
                        variant={
                          item.priority === 'HIGH'
                            ? 'danger'
                            : item.priority === 'MEDIUM'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {item.priority} Priority
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600">
                      <strong className="text-slate-700">Skill Gap:</strong> {item.gap}
                    </p>
                    <p className="text-xs text-slate-700">
                      <strong className="text-slate-800">Action:</strong> {item.recommendedAction}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mentor Annotations Section */}
        <Card className="border-slate-200 shadow-sm print:hidden">
          <CardContent className="p-6">
            <MentorFeedbackList
              token={token!}
              feedbackList={mentorFeedback || []}
              onFeedbackAdded={() => refetch()}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
