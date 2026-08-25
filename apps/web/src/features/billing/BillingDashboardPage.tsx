import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBilling } from '../../hooks/useBilling';
import { useI18nStore } from '../../stores/i18n.store';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import {
  CreditCard,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Receipt,
  FileText,
  Calendar,
  Mic,
} from 'lucide-react';

export function BillingDashboardPage() {
  const navigate = useNavigate();
  const { t, language } = useI18nStore();
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
      setSuccessMessage(
        language === 'vi'
          ? 'Gói tài khoản của bạn sẽ tự động kết thúc vào cuối kỳ thanh toán hiện tại.'
          : 'Your subscription will cancel at the end of the current billing period.',
      );
      setIsCancelModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to cancel subscription.');
    }
  };

  const isLoading = isLoadingSubscription || isLoadingUsage || isLoadingInvoices;

  if (isLoading && !subscription) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">
          {language === 'vi' ? 'Đang tải thông tin gói & thanh toán...' : 'Loading your billing details...'}
        </p>
      </div>
    );
  }

  const plan = subscription?.plan;
  const sessionsLimit = usage?.sessionsLimit || 5;
  const sessionsUsed = usage?.sessionsUsed || 0;
  const sessionsPercent = Math.min(100, Math.round((sessionsUsed / sessionsLimit) * 100));

  const voiceLimit = usage?.voiceMinutesLimit || 60;
  const voiceUsed = usage?.voiceMinutesUsed || 0;
  const voicePercent = Math.min(100, Math.round((voiceUsed / voiceLimit) * 100));

  return (
    <div className="max-w-5xl mx-auto space-y-8" data-testid="billing-dashboard-page">
      {/* Header */}
      <PageHeader
        title={t.billing.title}
        subtitle={t.billing.subtitle}
        actions={
          <Button
            variant="primary"
            onClick={() => navigate('/pricing')}
            className="gap-1.5 shadow-sm font-semibold"
            leftIcon={<ArrowUpRight className="w-4 h-4" />}
          >
            <span>{t.billing.changePlan}</span>
          </Button>
        }
      />

      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

      {/* Subscription Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/60 border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-700">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  {t.billing.currentPlan}: {plan?.nameVi || plan?.name || 'Free Tier'}
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'vi' ? 'Trạng thái: ' : 'Status: '}
                  <span className="font-bold text-slate-700">
                    {subscription?.status || 'ACTIVE'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Badge variant={subscription?.status === 'ACTIVE' ? 'success' : 'warning'}>
                {subscription?.status || 'ACTIVE'}
              </Badge>
              {subscription?.cancelAtPeriodEnd && (
                <Badge variant="danger">
                  {language === 'vi' ? 'Hủy cuối kỳ' : 'Cancels at Period End'}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block font-medium">
                {language === 'vi' ? 'Giá Gói Hàng Tháng' : 'Monthly Price'}
              </span>
              <span className="text-lg font-extrabold text-slate-900 font-mono mt-1 block">
                ${plan?.priceMonthly || 0} / {language === 'vi' ? 'tháng' : 'mo'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block font-medium">
                {language === 'vi' ? 'Chu Kỳ Hiện Tại Đến' : 'Current Billing Cycle'}
              </span>
              <span className="text-xs font-bold text-slate-800 flex items-center mt-1.5">
                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                {subscription?.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block font-medium">
                {language === 'vi' ? 'Cổng Thanh Toán' : 'Payment Method'}
              </span>
              <span className="text-xs font-bold text-slate-800 flex items-center mt-1.5">
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
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                {language === 'vi' ? 'Hủy Gói Đăng Ký' : 'Cancel Subscription'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Quota Consumption Meters */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <Zap className="w-5 h-5 text-amber-500" />
          <span>{t.billing.usageSummary}</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Interview Sessions Meter */}
          <Card className="p-5 border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>{t.billing.mockInterviewsUsed}</span>
              </span>
              <span className="font-mono text-slate-900">
                {sessionsUsed} / {sessionsLimit} ({sessionsPercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  sessionsPercent >= 90
                    ? 'bg-rose-500'
                    : sessionsPercent >= 70
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${sessionsPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {language === 'vi'
                ? 'Hạn mức tự động làm mới vào đầu mỗi chu kỳ thanh toán.'
                : 'Resets automatically at the start of next billing period.'}
            </p>
          </Card>

          {/* Voice Audio Minutes Meter */}
          <Card className="p-5 border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 flex items-center gap-1.5">
                <Mic className="h-4 w-4 text-indigo-600" />
                <span>{t.billing.voiceMinutesUsed}</span>
              </span>
              <span className="font-mono text-slate-900">
                {voiceUsed} / {voiceLimit} min ({voicePercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  voicePercent >= 90
                    ? 'bg-rose-500'
                    : voicePercent >= 70
                    ? 'bg-amber-500'
                    : 'bg-indigo-500'
                }`}
                style={{ width: `${voicePercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {language === 'vi'
                ? 'Sử dụng cho hệ thống tổng hợp giọng đọc AI và chuyển ngữ lời nói.'
                : 'Used for Whisper transcription and AI voice streaming synthesis.'}
            </p>
          </Card>
        </div>
      </div>

      {/* Invoice History Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-slate-500" />
            <CardTitle className="text-base font-bold text-slate-900">
              {t.billing.invoicesHistory}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              {language === 'vi'
                ? 'Chưa có hóa đơn thanh toán nào trong tài khoản này.'
                : 'No invoice records found for this account.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {invoices.map(inv => (
                <div
                  key={inv.id}
                  className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="font-semibold text-slate-900">
                        {language === 'vi' ? 'Hóa đơn' : 'Invoice'} ${inv.amountTotal.toFixed(2)}{' '}
                        {inv.currency}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {language === 'vi' ? 'Ngày lập: ' : 'Issued: '}
                        {new Date(inv.issuedAt).toLocaleDateString()}
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
                        className="text-emerald-600 hover:text-emerald-800 font-bold"
                      >
                        {t.billing.downloadInvoice}
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
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title={language === 'vi' ? 'Xác Nhận Hủy Gói?' : 'Cancel Subscription?'}
        description={
          language === 'vi'
            ? 'Bạn vẫn sẽ duy trì quyền truy cập đầy đủ cho đến hết chu kỳ thanh toán hiện tại.'
            : 'You will retain full access until the end of your current billing period.'
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              {language === 'vi'
                ? 'Sau khi hết hạn, tài khoản sẽ chuyển về gói Miễn Phí với hạn mức 5 lượt/tháng.'
                : 'After period end, account reverts to Free Tier with 5 monthly sessions.'}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isCancelingSubscription}
            >
              {language === 'vi' ? 'Giữ Gói' : 'Keep Subscription'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancelConfirm}
              isLoading={isCancelingSubscription}
            >
              {language === 'vi' ? 'Xác Nhận Hủy' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default BillingDashboardPage;
