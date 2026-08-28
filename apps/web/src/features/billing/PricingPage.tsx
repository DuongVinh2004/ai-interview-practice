import { useState } from 'react';
import { useBilling } from '../../hooks/useBilling';
import { useI18nStore } from '../../stores/i18n.store';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../../components/ui/Button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { VietQrCheckoutModal } from '../../components/billing/VietQrCheckoutModal';
import { Check, Sparkles, Zap, Shield, Rocket, QrCode } from 'lucide-react';
import { PLAN_TIERS, PlanTierSlug } from '../../lib/plan-tier.utils';

export function PricingPage() {
  const {
    plans,
    isLoadingPlans,
    subscription,
    createCheckout,
    isCreatingCheckout,
    createPayosCheckout,
    isCreatingPayosCheckout,
  } = useBilling();
  const { language } = useI18nStore();
  const { isAuthenticated } = useAuthStore();

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(null);
  const [payosData, setPayosData] = useState<any | null>(null);
  const [showVietQrModal, setShowVietQrModal] = useState<boolean>(false);

  const handleSelectPlan = async (planSlug: string) => {
    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }
    if (planSlug === 'free') return;
    setSelectedPlanSlug(planSlug);
    try {
      const response = await createCheckout({
        planSlug,
        billingCycle,
        successUrl: `${window.location.origin}/billing/success`,
        cancelUrl: `${window.location.origin}/pricing`,
      });

      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      }
    } catch (err) {
      console.error('Checkout failed', err);
    }
  };

  const handlePayosCheckout = async (planSlug: string) => {
    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }
    if (planSlug === 'free') return;
    setSelectedPlanSlug(planSlug);
    try {
      const response = await createPayosCheckout({
        planSlug,
        billingCycle,
      });
      setPayosData(response);
      setShowVietQrModal(true);
    } catch (err) {
      console.error('PayOS checkout failed', err);
    }
  };

  if (isLoadingPlans && (!plans || plans.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">
          {language === 'vi'
            ? 'Đang tải thông tin gói dịch vụ...'
            : 'Loading subscription tiers...'}
        </p>
      </div>
    );
  }

  const currentPlanSlug = subscription?.plan?.slug || 'free';

  return (
    <div className="max-w-7xl mx-auto space-y-12 py-6 px-4" data-testid="pricing-page">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <Badge variant="default" className="bg-emerald-50 text-emerald-800 border-emerald-200">
          <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-600" />
          <span>
            {language === 'vi'
              ? 'Lộ trình Luyện tập Linh hoạt cho Mọi Cấp độ'
              : 'Flexible Plans for Every Career Stage'}
          </span>
        </Badge>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          {language === 'vi'
            ? 'Bảng Giá & Gói Tài Khoản Luyện Phỏng Vấn'
            : 'Accelerate Your Interview Mastery'}
        </h1>

        <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
          {language === 'vi'
            ? 'Luyện tập không giới hạn với AI Orchestrator, Live Coding Sandbox, Whiteboard System Design và Đánh giá khung STAR.'
            : 'Unlimited AI interview simulations, real-time code execution sandbox, whiteboard system design, and STAR framework assessment.'}
        </p>

        {/* Monthly / Yearly Toggle */}
        <div className="flex items-center justify-center pt-4">
          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{language === 'vi' ? 'Hàng tháng (Monthly)' : 'Monthly Billing'}</span>
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all ${
                billingCycle === 'yearly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{language === 'vi' ? 'Hàng năm (Annual Billing)' : 'Annual Billing'}</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {language === 'vi' ? 'Tiết kiệm ~17%' : 'Save ~17%'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map(plan => {
          const isCurrent = isAuthenticated && currentPlanSlug === plan.slug;
          const currentRank =
            PLAN_TIERS[(currentPlanSlug?.toLowerCase() as PlanTierSlug) || 'free']?.rank ?? 0;
          const cardRank =
            PLAN_TIERS[(plan.slug?.toLowerCase() as PlanTierSlug) || 'free']?.rank ?? 0;
          const isLower = isAuthenticated && cardRank < currentRank;
          const isNextHigher = isAuthenticated && cardRank === currentRank + 1;
          const isPopular = isNextHigher || (currentRank === 0 && plan.slug === 'pro');
          const price =
            billingCycle === 'yearly' && plan.priceYearly > 0
              ? Math.round(plan.priceYearly / 12)
              : plan.priceMonthly;

          return (
            <Card
              key={plan.slug}
              className={`relative flex flex-col justify-between transition-all duration-200 rounded-2xl ${
                isPopular
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xl'
                  : 'border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md'
              }`}
              data-testid={`pricing-card-${plan.slug}`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="bg-emerald-600 text-white text-[11px] font-bold px-3.5 py-1 rounded-full shadow-md flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    <span>
                      {isNextHigher
                        ? language === 'vi'
                          ? 'Gợi ý nâng cấp tiếp theo'
                          : 'Recommended Next Upgrade'
                        : language === 'vi'
                          ? 'Phổ biến nhất (Most Popular)'
                          : 'Most Popular'}
                    </span>
                  </span>
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
                    {plan.slug === 'free' && <Zap className="w-5 h-5 text-slate-600" />}
                    {plan.slug === 'pro' && <Rocket className="w-5 h-5 text-emerald-600" />}
                    {plan.slug === 'team' && <Sparkles className="w-5 h-5 text-indigo-600" />}
                    {plan.slug === 'enterprise' && <Shield className="w-5 h-5 text-amber-600" />}
                  </div>

                  {isCurrent && (
                    <Badge variant="success" className="text-[10px]">
                      {language === 'vi' ? 'Gói hiện tại' : 'Current Plan'}
                    </Badge>
                  )}
                  {isLower && (
                    <Badge variant="default" className="text-[10px] bg-slate-100 text-slate-600">
                      {language === 'vi' ? 'Đã bao gồm' : 'Included'}
                    </Badge>
                  )}
                </div>

                <CardTitle className="text-xl font-bold text-slate-900">
                  {plan.nameVi || plan.name}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 min-h-[36px]">
                  {(plan as any).descriptionVi || plan.description}
                </CardDescription>

                <div className="pt-4 flex items-baseline">
                  <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                    {price === 0
                      ? language === 'vi'
                        ? 'Miễn phí'
                        : 'Free'
                      : `${price.toLocaleString('vi-VN')}đ`}
                  </span>
                  {price > 0 && (
                    <span className="text-xs text-slate-500 font-semibold ml-1.5">
                      {language === 'vi' ? '/tháng' : '/mo'}
                    </span>
                  )}
                </div>
                {billingCycle === 'yearly' && plan.priceYearly > 0 && (
                  <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
                    {language === 'vi'
                      ? `Billed annually (${plan.priceYearly.toLocaleString('vi-VN')}đ/năm)`
                      : `Billed annually ($${plan.priceYearly}/yr)`}
                  </span>
                )}
              </CardHeader>

              <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {language === 'vi' ? 'Quyền lợi & Tính năng' : 'Features Included'}
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-600">
                    <li className="flex items-start space-x-2">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="font-semibold text-slate-800">
                        {plan.limits.sessionsPerMonth >= 999
                          ? language === 'vi'
                            ? 'Không giới hạn lượt phỏng vấn'
                            : 'Unlimited mock sessions'
                          : `${plan.limits.sessionsPerMonth} ${
                              language === 'vi' ? 'buổi phỏng vấn/tháng' : 'interviews/mo'
                            }`}
                      </span>
                    </li>
                    {plan.limits.voiceMinutesPerMonth > 0 && (
                      <li className="flex items-start space-x-2">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>
                          {language === 'vi'
                            ? `${plan.limits.voiceMinutesPerMonth} phút Mock Voice AI giọng nói`
                            : `${plan.limits.voiceMinutesPerMonth} min AI Voice streaming`}
                        </span>
                      </li>
                    )}
                    {plan.limits.allowLiveCoding && (
                      <li className="flex items-start space-x-2">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>Live Coding sandbox</span>
                      </li>
                    )}
                    {plan.limits.allowSystemDesign && (
                      <li className="flex items-start space-x-2">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>Whiteboard System Design</span>
                      </li>
                    )}
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Call to action button */}
                <div className="space-y-2">
                  <Button
                    variant={isPopular ? 'primary' : 'outline'}
                    size="md"
                    onClick={() => handleSelectPlan(plan.slug)}
                    disabled={
                      isCurrent || isLower || (isCreatingCheckout && selectedPlanSlug === plan.slug)
                    }
                    isLoading={isCreatingCheckout && selectedPlanSlug === plan.slug}
                    className="w-full font-bold shadow-xs"
                    data-testid={`select-plan-${plan.slug}`}
                  >
                    {isCurrent
                      ? language === 'vi'
                        ? 'Gói hiện tại'
                        : 'Active Plan'
                      : isLower
                        ? language === 'vi'
                          ? 'Đã bao gồm trong gói của bạn'
                          : 'Included in Current Plan'
                        : plan.slug === 'free'
                          ? language === 'vi'
                            ? 'Miễn phí vĩnh viễn'
                            : 'Free Forever'
                          : language === 'vi'
                            ? `Nâng cấp lên ${plan.nameVi || plan.name}`
                            : `Upgrade to ${plan.name}`}
                  </Button>

                  {plan.slug !== 'free' && !isCurrent && !isLower && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePayosCheckout(plan.slug)}
                      disabled={isCreatingPayosCheckout && selectedPlanSlug === plan.slug}
                      isLoading={isCreatingPayosCheckout && selectedPlanSlug === plan.slug}
                      className="w-full text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border-emerald-300"
                    >
                      <QrCode className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      <span>{language === 'vi' ? 'Thanh toán VietQR' : 'Pay with VietQR'}</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* VietQR Checkout Modal */}
      {showVietQrModal && payosData && (
        <VietQrCheckoutModal
          isOpen={showVietQrModal}
          onClose={() => {
            setShowVietQrModal(false);
            setPayosData(null);
          }}
          paymentData={payosData}
          onPaymentSuccess={() => {
            setShowVietQrModal(false);
            if (typeof window !== 'undefined') {
              window.location.href = '/billing?payment=success';
            }
          }}
        />
      )}
    </div>
  );
}

export default PricingPage;
