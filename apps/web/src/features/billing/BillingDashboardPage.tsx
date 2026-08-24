import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBilling } from '../../hooks/useBilling';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import {
  CreditCard,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Receipt,
  FileText,
  Calendar,
} from 'lucide-react';

export function BillingDashboardPage() {
  const navigate = useNavigate();
  const {
    subscription,
    isLoadingSubscription,
    usage,
    isLoadingUsage,
    invoices,
    isLoadingInvoices,
    cancelSubscription,
    isCancelingSubscription,
  } = useBilling();

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCancelConfirm = async () => {
    try {
      setErrorMessage(null);
      await cancelSubscription();
      setSuccessMessage('Your subscription will cancel at the end of the current billing period.');
      setIsCancelModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to cancel subscription.');
    }
  };

  const isLoading = isLoadingSubscription || isLoadingUsage || isLoadingInvoices;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading your billing details...</p>
      </div>
    );
  }

  const plan = subscription?.plan;
  const sessionsLimit = usage?.sessionsLimit || 3;
  const sessionsUsed = usage?.sessionsUsed || 0;
  const sessionsPercent = Math.min(100, Math.round((sessionsUsed / sessionsLimit) * 100));

  const voiceLimit = usage?.voiceMinutesLimit || 15;
  const voiceUsed = usage?.voiceMinutesUsed || 0;
  const voicePercent = Math.min(100, Math.round((voiceUsed / voiceLimit) * 100));

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-6 px-4" data-testid="billing-dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Billing & Usage Management</h1>
          <p className="text-slate-500 text-sm mt-1">
            Monitor real-time resource consumption, active subscriptions, and payment history.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => navigate('/pricing')}
          className="gap-1.5 shadow-sm"
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Change Plan</span>
        </Button>
      </div>

      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      {/* Subscription Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 rounded-lg text-primary-700">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Current Plan: {plan?.name || 'Free Tier'}
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Status: <span className="font-semibold text-slate-700">{subscription?.status || 'ACTIVE'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Badge variant={subscription?.status === 'ACTIVE' ? 'success' : 'warning'}>
                {subscription?.status || 'ACTIVE'}
              </Badge>
              {subscription?.cancelAtPeriodEnd && (
                <Badge variant="danger">Cancels at Period End</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block">Monthly Price</span>
              <span className="text-lg font-bold text-slate-900 font-mono">
                ${plan?.priceMonthly || 0} / mo
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block">Current Billing Cycle</span>
              <span className="text-xs font-semibold text-slate-800 flex items-center mt-1">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {subscription?.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-slate-500 block">Payment Method</span>
              <span className="text-xs font-semibold text-slate-800 flex items-center mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                {subscription?.provider || 'MOCK'} Gateway
              </span>
            </div>
          </div>

          {plan?.slug !== 'free' && !subscription?.cancelAtPeriodEnd && (
            <div className="pt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCancelModalOpen(true)}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                Cancel Subscription
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Quota Consumption Meters */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <Zap className="w-5 h-5 text-amber-500" />
          <span>Monthly Quota & Resource Usage</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Interview Sessions Meter */}
          <Card className="p-5 border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700">Interview Sessions</span>
              <span className="font-mono text-slate-900">
                {sessionsUsed} / {sessionsLimit} used ({sessionsPercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  sessionsPercent >= 90 ? 'bg-rose-500' : sessionsPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${sessionsPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Resets automatically at the start of next billing period.
            </p>
          </Card>

          {/* Voice Audio Minutes Meter */}
          <Card className="p-5 border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700">Voice Mode & Audio Minutes</span>
              <span className="font-mono text-slate-900">
                {voiceUsed} / {voiceLimit} min ({voicePercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  voicePercent >= 90 ? 'bg-rose-500' : voicePercent >= 70 ? 'bg-amber-500' : 'bg-primary-500'
                }`}
                style={{ width: `${voicePercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Used for ElevenLabs / Whisper streaming voice synthesis.
            </p>
          </Card>
        </div>
      </div>

      {/* Invoice History Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-slate-500" />
            <CardTitle className="text-base font-bold text-slate-900">Invoice History</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No invoice records found for this account.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {invoices.map(inv => (
                <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="font-semibold text-slate-900">
                        Invoice ${inv.amountTotal.toFixed(2)} {inv.currency}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Issued: {new Date(inv.issuedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Badge variant={inv.status === 'PAID' ? 'success' : 'default'}>
                      {inv.status}
                    </Badge>
                    {inv.pdfUrl && (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary-600 hover:text-primary-800 font-semibold"
                      >
                        PDF
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Cancel Subscription?</h3>
                <p className="text-xs text-slate-500">
                  You will retain full access until the end of your current billing period.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCancelModalOpen(false)}
                disabled={isCancelingSubscription}
              >
                Keep Subscription
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCancelConfirm}
                isLoading={isCancelingSubscription}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
