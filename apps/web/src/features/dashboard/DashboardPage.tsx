import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { PlayCircle, History, Sparkles, CheckCircle2, Award } from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-2">
          <Sparkles className="h-4 w-4" />
          <span>Interactive IT Mock Interviews</span>
        </div>
        <h1 className="text-3xl font-bold">
          Welcome back, {user?.profile?.fullName || user?.email}!
        </h1>
        <p className="text-slate-300 text-sm mt-2 max-w-xl">
          Sharpen your technical interview readiness with 5-question mock sessions tailored to your
          seniority level and technology stack.
        </p>

        <div className="flex gap-3 mt-6">
          <Link to="/interviews/new">
            <Button size="lg" variant="primary" className="gap-2">
              <PlayCircle className="h-5 w-5" />
              <span>Start New Interview</span>
            </Button>
          </Link>
          <Link to="/history">
            <Button size="lg" variant="secondary" className="gap-2 bg-slate-700 hover:bg-slate-600">
              <History className="h-5 w-5" />
              <span>View Past Results</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="bg-emerald-100 text-emerald-800 p-2.5 rounded-lg w-fit">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-base text-slate-900">Adaptive Difficulty</h3>
            <p className="text-xs text-slate-500">
              Questions dynamically adjust between Easy, Medium, and Hard based on your real-time
              answer quality.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="bg-blue-100 text-blue-800 p-2.5 rounded-lg w-fit">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-base text-slate-900">Structured Rubrics</h3>
            <p className="text-xs text-slate-500">
              Evaluated on technical accuracy, depth, and clarity with specific strengths and
              improvements identified.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="bg-purple-100 text-purple-800 p-2.5 rounded-lg w-fit">
              <Award className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-base text-slate-900">Custom Learning Path</h3>
            <p className="text-xs text-slate-500">
              Targeted skill gap analysis and prioritized learning recommendations after completing
              all 5 turns.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
