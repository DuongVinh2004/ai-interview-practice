import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { formatScore, formatDifficulty } from '../../lib/utils';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { History, PlayCircle, ChevronRight, Calendar } from 'lucide-react';

export function HistoryPage() {
  const { data, isLoading } = useQuery<{ items: any[]; meta: any }>({
    queryKey: ['interview-history'],
    queryFn: () => apiClient('/interviews/history'),
  });

  const sessions = data?.items || [];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading interview history...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your Interview History</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review your past interview sessions and score breakdowns
          </p>
        </div>
        <Link to="/interviews/new">
          <Button className="gap-2">
            <PlayCircle className="h-4 w-4" />
            <span>New Practice</span>
          </Button>
        </Link>
      </div>

      {sessions.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="flex flex-col items-center gap-3">
            <History className="h-10 w-10 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-800">No interview sessions found</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              You haven't completed any practice sessions yet. Start your first mock interview now!
            </p>
            <Link to="/interviews/new" className="mt-2">
              <Button size="sm">Start Practice</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const diff = formatDifficulty(s.targetDifficulty);
            return (
              <Card key={s.id} className="hover:border-slate-300 transition-colors">
                <CardContent className="p-5 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">
                        {s.jobRole.name} • {s.seniorityLevel.name}
                      </span>
                      <Badge variant={s.state === 'COMPLETED' ? 'success' : 'default'}>
                        {s.state}
                      </Badge>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${diff.color}`}
                      >
                        {diff.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>Technologies: {s.technologies.map((t: any) => t.name).join(', ')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {s.overallScore !== null && (
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Score</span>
                        <span className="font-bold text-base text-emerald-700">
                          {formatScore(s.overallScore)}/10
                        </span>
                      </div>
                    )}
                    <Link
                      to={
                        s.state === 'COMPLETED'
                          ? `/interviews/${s.id}/result`
                          : `/interviews/${s.id}`
                      }
                    >
                      <Button variant="outline" size="sm" className="gap-1">
                        <span>{s.state === 'COMPLETED' ? 'View Result' : 'Continue'}</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
