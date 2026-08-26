import React, { useState, useEffect } from 'react';
import { X, Copy, Check, QrCode, ExternalLink, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { PayosPaymentResponseDto } from '@ai-interview/contracts';

interface VietQrCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentData: PayosPaymentResponseDto | null;
  onPaymentSuccess?: () => void;
}

export const VietQrCheckoutModal: React.FC<VietQrCheckoutModalProps> = ({
  isOpen,
  onClose,
  paymentData,
  onPaymentSuccess,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(900); // 15 minutes

  useEffect(() => {
    if (!isOpen) return;
    setCountdown(900);
    const interval = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen || !paymentData) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const qrImageUrl =
    paymentData.qrCode && paymentData.qrCode.startsWith('http')
      ? paymentData.qrCode
      : `https://api.vietqr.io/image/${paymentData.bin || '970422'}-${paymentData.accountNumber || '0987654321'}-compact2.jpg?amount=${paymentData.amount}&addInfo=${encodeURIComponent(paymentData.description || 'AI INT')}&accountName=${encodeURIComponent(paymentData.accountName || 'AI INTERVIEW')}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vietqr-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <QrCode className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 id="vietqr-modal-title" className="font-bold text-sm">
                Thanh Toán VietQR Tự Động (PayOS)
              </h3>
              <p className="text-[11px] text-emerald-100">Kích hoạt tài khoản ngay lập tức 24/7</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* QR Code Presentation Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center space-y-3">
            <div className="w-52 h-52 bg-white rounded-xl p-2 border border-slate-200 shadow-inner flex items-center justify-center">
              <img
                src={qrImageUrl}
                alt="VietQR Payment Code"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-mono">
              <span>Hết hạn trong:</span>
              <strong className="text-rose-600 font-bold">{formatCountdown(countdown)}</strong>
            </div>
          </div>

          {/* Bank Transfer Details Table */}
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-medium">Ngân hàng:</span>
              <span className="font-bold text-slate-900">MBBank (Ngân Hàng Quân Đội)</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-medium">Chủ tài khoản:</span>
              <span className="font-bold text-slate-900">
                {paymentData.accountName || 'AI INTERVIEW PRACTICE'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-medium">Số tài khoản:</span>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-slate-900">
                  {paymentData.accountNumber || '0987654321'}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(paymentData.accountNumber || '0987654321', 'acc')}
                  className="p-1 text-slate-500 hover:text-emerald-600"
                >
                  {copiedField === 'acc' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-emerald-800 font-medium">Số tiền thanh toán:</span>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {Number(paymentData.amount).toLocaleString('vi-VN')} VND
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(String(paymentData.amount), 'amt')}
                  className="p-1 text-emerald-600 hover:text-emerald-800"
                >
                  {copiedField === 'amt' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 font-medium">Nội dung chuyển khoản:</span>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-indigo-600">
                  {paymentData.description || 'AI INT'}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(paymentData.description || 'AI INT', 'desc')}
                  className="p-1 text-slate-500 hover:text-indigo-600"
                >
                  {copiedField === 'desc' ? (
                    <Check className="w-3.5 h-3.5 text-indigo-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Chuyển đúng nội dung và số tiền để hệ thống tự động ghi nhận trong 3-5 giây.
            </span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          {paymentData.checkoutUrl && (
            <a
              href={paymentData.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold hover:underline"
            >
              <span>Mở cổng PayOS</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl text-xs"
            >
              Đóng
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setIsVerifying(true);
                setTimeout(() => {
                  setIsVerifying(false);
                  onPaymentSuccess?.();
                  onClose();
                }, 1500);
              }}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isVerifying && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              <span>Tôi đã chuyển khoản</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
