import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useI18nStore } from '../../stores/i18n.store';
import { ShareExpiryDuration } from '@ai-interview/contracts';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { Alert } from '../ui/Alert';
import { Share2, Copy, Check, Eye, Trash2, Globe, Clock, UserX, X } from 'lucide-react';

interface ShareSessionModalProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareSessionModal({ sessionId, isOpen, onClose }: ShareSessionModalProps) {
  const { t } = useI18nStore();

  const [expiry, setExpiry] = useState<ShareExpiryDuration>(ShareExpiryDuration.SEVEN_DAYS);
  const [isAnonymized, setIsAnonymized] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: shareTokens = [],
    isLoading,
    refetch,
  } = useQuery<any[]>({
    queryKey: ['session-shares', sessionId],
    queryFn: () => apiClient(`/interviews/${sessionId}/shares`),
    enabled: isOpen && !!sessionId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient(`/interviews/${sessionId}/share`, {
        method: 'POST',
        body: JSON.stringify({ expiry, isAnonymized }),
      }),
    onSuccess: (newShare: any) => {
      refetch();
      handleCopy(newShare.token);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to create share link');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) =>
      apiClient(`/interviews/${sessionId}/shares/${tokenId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      refetch();
    },
  });

  const handleCopy = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}/share/${token}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{t.share.shareTitle}</h3>
              <p className="text-xs text-slate-500">{t.share.shareSubtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

        {/* Generate Link Controls */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>{t.share.expiryOption}</span>
              </label>
              <select
                value={expiry}
                onChange={e => setExpiry(e.target.value as ShareExpiryDuration)}
                className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value={ShareExpiryDuration.ONE_DAY}>{t.share.expiry1d}</option>
                <option value={ShareExpiryDuration.SEVEN_DAYS}>{t.share.expiry7d}</option>
                <option value={ShareExpiryDuration.THIRTY_DAYS}>{t.share.expiry30d}</option>
                <option value={ShareExpiryDuration.NEVER}>{t.share.expiryNever}</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none bg-white p-2.5 rounded-lg border border-slate-300 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={isAnonymized}
                  onChange={e => setIsAnonymized(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <UserX className="h-4 w-4 text-slate-500" />
                <span className="text-[11px] leading-tight">{t.share.anonymizeOption}</span>
              </label>
            </div>
          </div>

          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="w-full gap-2"
            size="md"
          >
            {createMutation.isPending ? <Spinner size="sm" /> : <Globe className="h-4 w-4" />}
            <span>{t.share.createLink}</span>
          </Button>
        </div>

        {/* Existing Active Share Links */}
        <div className="space-y-2.5">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Active & Past Share Links ({shareTokens.length})
          </h4>

          {isLoading ? (
            <div className="py-6 flex justify-center">
              <Spinner size="md" />
            </div>
          ) : shareTokens.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center bg-slate-50 rounded-lg border border-slate-100">
              No share links created yet.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {shareTokens.map(token => {
                const isCopied = copiedToken === token.token;
                return (
                  <div
                    key={token.id}
                    className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs shadow-2xl-sm"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {token.isRevoked ? (
                          <Badge variant="danger">{t.share.revokedBadge}</Badge>
                        ) : (
                          <Badge variant="success">{t.share.activeBadge}</Badge>
                        )}
                        {token.isAnonymized && (
                          <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-mono">
                            Anonymized
                          </span>
                        )}
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {token.viewCount} {t.share.viewsCount}
                        </span>
                      </div>
                      <p className="text-slate-500 font-mono text-[11px] truncate">
                        /share/{token.token.slice(0, 12)}...
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!token.isRevoked && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleCopy(token.token)}
                            className="gap-1 px-2.5"
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-emerald-700 font-semibold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </Button>

                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => revokeMutation.mutate(token.id)}
                            disabled={revokeMutation.isPending}
                            className="px-2"
                            title="Revoke link"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
