import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { useI18nStore } from '../../stores/i18n.store';
import { ShareExpiryDuration } from '@ai-interview/contracts';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { Alert } from '../ui/Alert';
import { Modal } from '../ui/Modal';
import { Copy, Check, Eye, Trash2, Globe, Clock, UserX } from 'lucide-react';

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
  } = useQuery({
    queryKey: ['shareTokens', sessionId],
    queryFn: async () => {
      const res = await apiClient<any>(`/interviews/${sessionId}/shares`);
      return Array.isArray(res) ? res : res?.data || [];
    },
    enabled: isOpen && !!sessionId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient<{ data: any }>(`/interviews/${sessionId}/shares`, {
        method: 'POST',
        body: JSON.stringify({
          expiry,
          isAnonymized,
        }),
      }),
    onSuccess: () => {
      refetch();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to create share link.');
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

  const activeShares = shareTokens;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t.share.shareTitle}
      description={t.share.shareSubtitle}
      maxWidth="xl"
    >
      <div className="space-y-5">
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
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={ShareExpiryDuration.ONE_DAY}>{t.share.expiry1d}</option>
                <option value={ShareExpiryDuration.SEVEN_DAYS}>{t.share.expiry7d}</option>
                <option value={ShareExpiryDuration.THIRTY_DAYS}>{t.share.expiry30d}</option>
                <option value={ShareExpiryDuration.NEVER}>{t.share.expiryNever}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                <UserX className="h-3.5 w-3.5 text-slate-500" />
                <span>{t.share.anonymizeOption}</span>
              </label>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymized}
                  onChange={e => setIsAnonymized(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-slate-300"
                />
                <span className="text-xs text-slate-600">{t.share.anonymizeOption}</span>
              </label>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="w-full justify-center"
          >
            {createMutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Loading...
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" />
                {t.share.createLink}
              </>
            )}
          </Button>
        </div>

        {/* Existing Links Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active & Past Share Links ({activeShares.length})
          </h4>

          {isLoading ? (
            <div className="py-4 flex justify-center">
              <Spinner size="md" />
            </div>
          ) : activeShares.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No share links created yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {activeShares.map((token: any) => {
                const isRevoked = token.isRevoked || token.status === 'REVOKED';
                const isCopied = copiedToken === token.token;

                return (
                  <div
                    key={token.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isRevoked ? (
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
                      {!isRevoked && (
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
    </Modal>
  );
}
