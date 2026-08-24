import React from 'react';
import { CertificateDto } from '@ai-interview/contracts';
import { Download, Share2, Award, ExternalLink, CheckCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface CertificateViewerProps {
  certificate: CertificateDto & { recipientName?: string; verificationUrl?: string };
  onDownload?: () => void;
  onShare?: () => void;
}

export const CertificateViewer: React.FC<CertificateViewerProps> = ({
  certificate,
  onDownload,
  onShare,
}) => {
  const verifyUrl =
    certificate.verificationUrl ||
    `${window.location.origin}/verify/${certificate.id}`;

  return (
    <div className="flex flex-col items-center">
      {/* Ornate Certificate Canvas */}
      <div
        className="w-full max-w-2xl bg-gradient-to-b from-amber-50/40 via-white to-amber-50/20 border-8 border-double border-amber-600/30 rounded-2xl p-8 sm:p-12 shadow-2xl relative overflow-hidden"
        data-testid="certificate-canvas"
      >
        {/* Background Watermark Seal */}
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <Award className="w-96 h-96 text-emerald-900" />
        </div>

        {/* Top Header & Crest */}
        <div className="text-center relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-emerald-600 text-white shadow-lg mb-4">
            <Award className="h-9 w-9" />
          </div>
          <p className="text-xs tracking-[0.3em] uppercase text-amber-700 font-bold">
            Verified Digital Credential
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
            CERTIFICATE OF EXCELLENCE
          </h1>
          <p className="text-sm text-slate-500 mt-1 italic">
            This is to officially certify that
          </p>
        </div>

        {/* Recipient Name */}
        <div className="text-center my-6 relative z-10">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-emerald-800 border-b-2 border-amber-500/40 inline-block px-8 pb-2">
            {certificate.recipientName || 'Candidate'}
          </h2>
        </div>

        {/* Description & Competency */}
        <div className="text-center text-sm text-slate-700 max-w-md mx-auto relative z-10 leading-relaxed">
          <p>
            has demonstrated exceptional technical competence and interview proficiency in{' '}
            <strong className="text-slate-900 font-bold">
              {certificate.competencyArea ? certificate.competencyArea.replace(/_/g, ' ') : 'Full-Stack Architecture'}
            </strong>{' '}
            with an evaluated mastery score of{' '}
            <strong className="text-emerald-700 font-bold text-base">
              {certificate.score.toFixed(1)} / 10.0
            </strong>.
          </p>
        </div>

        {/* Bottom Metadata: Signatures, QR, Seal */}
        <div className="mt-10 pt-6 border-t border-amber-900/20 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end relative z-10">
          {/* Issue Details */}
          <div className="text-left">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Issue Date
            </p>
            <p className="text-xs font-bold text-slate-800 mt-0.5">
              {certificate.issuedAt
                ? new Date(certificate.issuedAt).toLocaleDateString()
                : new Date().toLocaleDateString()}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              Certificate ID: {certificate.id.slice(0, 8)}...
            </p>
          </div>

          {/* QR Verification Code */}
          <div className="flex flex-col items-center justify-center">
            {certificate.qrCodeUrl ? (
              <img
                src={certificate.qrCodeUrl}
                alt="Verification QR Code"
                className="w-20 h-20 border border-slate-200 rounded p-1 bg-white shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 bg-slate-100 border border-slate-300 rounded flex items-center justify-center text-[10px] text-slate-400 text-center p-1">
                Scan to Verify
              </div>
            )}
            <span className="text-[10px] font-semibold text-emerald-700 mt-1 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Cryptographically Signed
            </span>
          </div>

          {/* Authority Seal */}
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
              Issuing Authority
            </p>
            <p className="text-xs font-bold text-slate-800 mt-0.5">
              AI Interview Practice CA
            </p>
            <p className="text-[10px] text-emerald-600 font-mono mt-1 break-all">
              HMAC-SHA256: {certificate.signatureHash.slice(0, 10)}...
            </p>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
        {onDownload && (
          <Button variant="primary" size="md" onClick={onDownload} className="gap-2">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        )}
        {onShare && (
          <Button variant="outline" size="md" onClick={onShare} className="gap-2">
            <Share2 className="h-4 w-4" /> Share Credential
          </Button>
        )}
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ExternalLink className="h-4 w-4" /> Verify Publicly
        </a>
      </div>
    </div>
  );
};
