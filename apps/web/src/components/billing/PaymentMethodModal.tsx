import React, { useState } from 'react';
import { X, CreditCard, QrCode, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { useI18nStore } from '../../stores/i18n.store';

export type PaymentMethod = 'stripe' | 'payos';

export interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  planSlug: string;
  priceFormatted: string;
  billingCycle: 'monthly' | 'yearly';
  onConfirm: (method: PaymentMethod) => void;
  isLoading?: boolean;
}

export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  isOpen,
  onClose,
  planName,
  planSlug,
  priceFormatted,
  billingCycle,
  onConfirm,
  isLoading = false,
}) => {
  const { language } = useI18nStore();
  const isVi = language === 'vi';
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('payos');

  if (!isOpen) return null;

  const cycleText =
    billingCycle === 'yearly' ? (isVi ? 'Theo năm' : 'Annual') : isVi ? 'Theo tháng' : 'Monthly';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-method-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
      data-testid="payment-method-modal"
      data-plan={planSlug}
      data-plan-slug={planSlug}
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 id="payment-method-modal-title" className="font-bold text-base">
                {isVi ? 'Chọn phương thức thanh toán' : 'Select Payment Method'}
              </h3>
              <p className="text-xs text-indigo-200">
                {isVi ? 'Kích hoạt tài khoản an toàn & tức thì' : 'Secure and instant activation'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Order Summary Box */}
          <div className="p-4 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border border-indigo-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">
                {isVi ? 'Gói dịch vụ đã chọn' : 'Selected Tier'}
              </span>
              <span className="text-base font-extrabold text-slate-900">{planName}</span>
              <span className="text-xs text-slate-500 block mt-0.5">{cycleText}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block font-medium">
                {isVi ? 'Tổng tiền' : 'Total'}
              </span>
              <span className="text-lg font-black text-slate-900 font-mono">{priceFormatted}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {isVi ? 'Phương thức khả dụng' : 'Available Options'}
            </div>

            {/* Option 1: VietQR (PayOS) */}
            <label
              htmlFor="method-payos"
              onClick={() => setSelectedMethod('payos')}
              className={`relative flex items-start p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedMethod === 'payos'
                  ? 'border-emerald-500 bg-emerald-50/30 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
              data-testid="method-payos"
            >
              <input
                type="radio"
                id="method-payos"
                name="paymentMethod"
                value="payos"
                checked={selectedMethod === 'payos'}
                onChange={() => setSelectedMethod('payos')}
                className="mt-1 h-4 w-4 text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <div className="ml-3.5 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-slate-900">VietQR (PayOS)</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {isVi ? 'Khuyên dùng tại VN' : 'Popular in VN'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {isVi
                    ? 'Quét mã QR qua mọi ứng dụng Ngân hàng (MBBank, VCB, Techcombank...) & Ví MoMo, ZaloPay. Tự động kích hoạt ngay trong 5 giây.'
                    : 'Scan QR code with any Vietnamese banking app or mobile wallet. Instant automated activation.'}
                </p>
              </div>
            </label>

            {/* Option 2: Stripe (International Cards) */}
            <label
              htmlFor="method-stripe"
              onClick={() => setSelectedMethod('stripe')}
              className={`relative flex items-start p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedMethod === 'stripe'
                  ? 'border-indigo-500 bg-indigo-50/30 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
              data-testid="method-stripe"
            >
              <input
                type="radio"
                id="method-stripe"
                name="paymentMethod"
                value="stripe"
                checked={selectedMethod === 'stripe'}
                onChange={() => setSelectedMethod('stripe')}
                className="mt-1 h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <div className="ml-3.5 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-sm text-slate-900">
                      {isVi ? 'Thẻ quốc tế (Stripe)' : 'Credit / Debit Card (Stripe)'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    Visa / Master / JCB
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  {isVi
                    ? 'Thanh toán bảo mật chuẩn quốc tế qua cổng Stripe. Hỗ trợ thẻ tín dụng, ghi nợ quốc tế, Apple Pay & Google Pay.'
                    : 'Secure international card checkout powered by Stripe. Supports Visa, MasterCard, JCB, Apple Pay.'}
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-slate-500 justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {isVi
                ? 'Giao dịch được mã hóa 256-bit SSL bảo mật tuyệt đối'
                : 'Transactions encrypted with 256-bit SSL security'}
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="text-xs font-semibold"
          >
            {isVi ? 'Đóng' : 'Cancel'}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => onConfirm(selectedMethod)}
            isLoading={isLoading}
            className="text-xs font-bold gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
            data-testid="confirm-payment-method-btn"
          >
            <span>
              {selectedMethod === 'payos'
                ? isVi
                  ? 'Tạo mã VietQR (PayOS)'
                  : 'Generate VietQR Code'
                : isVi
                  ? 'Chuyển đến cổng Stripe'
                  : 'Proceed with Stripe'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
