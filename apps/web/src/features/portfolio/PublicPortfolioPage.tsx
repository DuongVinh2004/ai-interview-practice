import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { PublicPortfolioProfileViewDto, CertificateDto } from '@ai-interview/contracts';
import { BadgeCard } from './components/BadgeCard';
import { CertificateModal } from './components/CertificateModal';
import {
  Award,
  ShieldCheck,
  Share2,
  Eye,
  Calendar,
  Sparkles,
  ExternalLink,
  Lock,
  Check,
  Layers,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const PublicPortfolioPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [selectedCert, setSelectedCert] = useState<(CertificateDto & { recipientName?: string }) | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: profile, isLoading, error } = useQuery<PublicPortfolioProfileViewDto>({
    queryKey: ['public-portfolio', username],
    queryFn: async () => {
      const res = await apiClient.get<PublicPortfolioProfileViewDto>(`/public/portfolio/${username}`, { skipAuth: true });
      return res.data;
    },
    enabled: !!username,
  });

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto animate-pulse" data-testid="portfolio-loading">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 h-64 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 h-96" />
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 h-96" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-lg border border-slate-200 text-center" data-testid="portfolio-error">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Portfolio Not Found or Private</h2>
          <p className="text-sm text-slate-600 mb-6">
            The profile for <span className="font-semibold">@{username}</span> either does not exist or has been made private by the owner.
          </p>
          <Link to="/">
            <Button variant="primary" size="md">
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Hero Profile Card */}
        <div
          className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-slate-200/80 relative overflow-hidden"
          data-testid="portfolio-hero"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center text-3xl font-bold shadow-lg shadow-emerald-500/20 flex-shrink-0">
                {profile.displayName ? profile.displayName[0].toUpperCase() : profile.username[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {profile.displayName || profile.realName || profile.username}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-500 mt-0.5">@{profile.username}</p>

                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    Member since {new Date(profile.memberSince).getFullYear()}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                    {profile.viewCount} views
                  </span>
                </div>
              </div>
            </div>

            {/* Actions & Readiness Summary */}
            <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-2 self-start sm:self-auto"
                data-testid="share-portfolio-btn"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
                {copied ? 'Link Copied!' : 'Share Portfolio'}
              </Button>

              {profile.readinessSummary && (
                <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl px-3.5 py-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <div className="text-xs">
                    <span className="text-slate-600 font-medium">Interview Readiness: </span>
                    <strong className="text-emerald-800 font-bold">
                      {profile.readinessSummary.readinessScore}% ({profile.readinessSummary.tierName})
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-6 text-sm text-slate-700 leading-relaxed border-t border-slate-100 pt-4">
              {profile.bio}
            </p>
          )}
        </div>

        {/* Competency Skills Radar / Breakdown */}
        {profile.skills && profile.skills.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80" data-testid="portfolio-skills">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Evaluated Competency Graph</h3>
                  <p className="text-xs text-slate-500">Benchmark skill performance validated through technical interview simulations</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.skills.map((skill) => (
                <div key={skill.area} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-800">{skill.name}</span>
                    <span className="text-sm font-extrabold text-emerald-700">
                      {skill.score.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ 10</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                      style={{ width: `${Math.min(skill.score * 10, 100)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">{skill.evidenceCount} verified evaluation samples</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verified Badges Section */}
        {profile.badges && profile.badges.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80" data-testid="portfolio-badges">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Verified Technical Badges</h3>
                <p className="text-xs text-slate-500">Earned through continuous evaluation benchmarks across interview dimensions</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profile.badges.map((b) => (
                <BadgeCard
                  key={b.id}
                  areaName={b.competencyArea.replace(/_/g, ' ')}
                  competencyArea={b.competencyArea}
                  level={b.level}
                  score={b.score}
                  evidenceCount={b.evidenceCount}
                  progressPercentage={100}
                  nextBadgeLevel={null}
                  requiredScore={null}
                  requiredEvidence={null}
                  isUnlocked={true}
                  earnedAt={b.earnedAt ? (typeof b.earnedAt === 'string' ? b.earnedAt : (b.earnedAt as any).toISOString()) : null}
                />
              ))}
            </div>
          </div>
        )}

        {/* Verified Digital Certificates */}
        {profile.certificates && profile.certificates.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80" data-testid="portfolio-certificates">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Verified Certificates</h3>
                <p className="text-xs text-slate-500">Cryptographically signed credentials verifiable by employers & recruiters</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.certificates.map((cert) => (
                <div
                  key={cert.id}
                  onClick={() =>
                    setSelectedCert({
                      ...cert,
                      recipientName: profile.displayName || profile.realName || profile.username,
                    })
                  }
                  className="p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-50/20 via-white to-amber-50/10 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                  data-testid="certificate-card"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        Verified Credential
                      </span>
                      <h4 className="font-serif font-bold text-base text-slate-900 mt-2">
                        {cert.competencyArea ? cert.competencyArea.replace(/_/g, ' ') : 'Architecture Mastery'}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Score: <strong className="text-emerald-700 font-bold">{cert.score.toFixed(1)}/10.0</strong>
                      </p>
                    </div>
                    <Award className="h-8 w-8 text-amber-600 flex-shrink-0" />
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                    <span>Issued: {cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString() : 'N/A'}</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1 hover:underline">
                      View Certificate <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History Highlights */}
        {profile.historyHighlights && profile.historyHighlights.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80" data-testid="portfolio-history">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Completed Interview Highlights</h3>
            <div className="divide-y divide-slate-100">
              {profile.historyHighlights.map((h) => (
                <div key={h.sessionId} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{h.roleName}</p>
                    <p className="text-xs text-slate-400">{new Date(h.completedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-sm font-bold text-emerald-700">
                    {h.score.toFixed(1)} / 10
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal for viewing certificates */}
      <CertificateModal
        isOpen={!!selectedCert}
        onClose={() => setSelectedCert(null)}
        certificate={selectedCert}
      />
    </div>
  );
};
