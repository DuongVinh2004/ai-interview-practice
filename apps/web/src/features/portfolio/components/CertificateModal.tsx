import React from 'react';
import { CertificateDto } from '@ai-interview/contracts';
import { X } from 'lucide-react';
import { CertificateViewer } from './CertificateViewer';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: (CertificateDto & { recipientName?: string; verificationUrl?: string }) | null;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  isOpen,
  onClose,
  certificate,
}) => {
  if (!isOpen || !certificate) return null;

  const handleDownload = () => {
    window.open(certificate.fileUrl || `/api/v1/certificates/${certificate.id}/download`, '_blank');
  };

  const handleShare = () => {
    const url = `${window.location.origin}/verify/${certificate.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      alert('Certificate verification link copied to clipboard!');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto"
      data-testid="certificate-modal"
    >
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl p-6 sm:p-8 my-8 border border-slate-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors z-20"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <CertificateViewer
          certificate={certificate}
          onDownload={handleDownload}
          onShare={handleShare}
        />
      </div>
    </div>
  );
};
