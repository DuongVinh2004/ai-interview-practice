import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { VerifyCertificateResponseDto } from '@ai-interview/contracts';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Award,
  ShieldCheck,
  Calendar,
  Eye,
  Hash,
  ArrowRight,
} from 'lucide-react';

export const VerifyCertificatePage: React.FC = () => {
  const { certId } = useParams<{ certId: string }>();

  const { data: cert, isLoading } = useQuery<VerifyCertificateResponseDto>({
    queryKey: ['verify-certificate', certId],
    queryFn: async () => {
      const res = await apiClient.get<VerifyCertificateResponseDto>(`/public/verify/${certId}`, { skipAuth: true });
      return res.data;
    },
    enabled: !!certId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" data-testid="verify-loading">
        <div className="max-w-xl w-full bg-white rounded-3xl p-10 shadow-lg border border-slate-200 animate-pulse space-y-6">
          <div className="h-16 bg-slate-100 rounded-2xl" />
          <div className="h-32 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  const isValid = cert?.isValid;
  const isRevoked = cert?.status === 'REVOKED';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Verification Status Header Banner */}
        <div
          className={`rounded-3xl p-6 sm:p-8 text-center shadow-lg border relative overflow-hidden transition-all ${
            isValid
              ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-500/40 shadow-emerald-500/20'
              : isRevoked
              ? 'bg-gradient-to-br from-rose-600 to-red-700 text-white border-rose-500/40 shadow-rose-500/20'
              : 'bg-gradient-to-br from-amber-600 to-orange-700 text-white border-amber-500/40 shadow-amber-500/20'
          }`}
          data-testid="verify-status-banner"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
            {isValid ? (
              <CheckCircle className="h-10 w-10 text-white" />
            ) : isRevoked ? (
              <XCircle className="h-10 w-10 text-white" />
            ) : (
              <AlertTriangle className="h-10 w-10 text-white" />
            )}
          </div>

          <span className="text-xs uppercase tracking-widest font-bold bg-white/20 px-3 py-1 rounded-full inline-block">
            {isValid ? 'Authenticity Verified' : isRevoked ? 'Certificate Revoked' : 'Verification Issue'}
          </span>

          <h1 className="text-2xl sm:text-3xl font-extrabold mt-3">
            {isValid
              ? 'Verified Official Credential'
              : isRevoked
              ? 'Certificate Has Been Revoked'
              : 'Certificate Expired or Tampered'}
          </h1>

          <p className="text-sm opacity-90 mt-2 max-w-md mx-auto">
            {cert?.message || 'Certificate verification result'}
          </p>
        </div>

        {/* Certificate Details Card */}
        {cert && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/80 space-y-6" data-testid="verify-details">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Recipient</span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">{cert.recipientName}</h3>
              </div>
              <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
                <Award className="h-8 w-8" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block">Competency Domain</span>
                <span className="text-sm font-bold text-slate-800 mt-1 block">
                  {cert.competencyArea ? cert.competencyArea.replace(/_/g, ' ') : 'Fullstack Architecture'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block">Verified Score</span>
                <span className="text-base font-extrabold text-emerald-700 mt-1 block">
                  {cert.score.toFixed(1)} / 10.0
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block">Issued Date</span>
                <span className="text-sm font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString() : 'N/A'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold block">Total Verifications</span>
                <span className="text-sm font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-slate-400" />
                  {cert.verifyCount} times
                </span>
              </div>
            </div>

            {/* Cryptographic Hash Integrity */}
            <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" /> HMAC-SHA256 Digital Signature
                </span>
                <span className="text-emerald-400 font-sans font-bold">256-bit Secure</span>
              </div>
              <p className="break-all text-slate-300 select-all font-medium">{cert.signatureHash || 'N/A'}</p>
            </div>

            {/* Platform Trust Note */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 border-t border-slate-100">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Issued by AI Interview Practice Verification Authority
              </span>
              <Link to="/" className="text-emerald-700 font-bold hover:underline flex items-center gap-1">
                Learn more about our evaluation engine <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
