import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export function CheckoutSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <Card className="text-center p-8 border-emerald-200 bg-emerald-50/20 shadow-md">
        <CardContent className="flex flex-col items-center space-y-4 pt-4">
          <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">Subscription Activated!</h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Thank you for upgrading! Your account has been upgraded with increased mock interview
            quotas and advanced features.
          </p>

          {sessionId && (
            <span className="text-[10px] text-slate-400 font-mono bg-white px-2.5 py-1 rounded border border-slate-200">
              Session ID: {sessionId.slice(0, 18)}...
            </span>
          )}

          <div className="pt-4 flex flex-col sm:flex-row gap-2 w-full">
            <Button
              variant="primary"
              onClick={() => navigate('/interviews/new')}
              className="w-full gap-1.5"
            >
              <span>Start Interview</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate('/billing')} className="w-full">
              Billing Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
