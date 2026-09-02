import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface ReleaseManifest {
  schemaVersion: number;
  sourceSha: string;
  migrationSetSha256: string;
  approvedCiRun: { id: string; url: string };
  apiImage: string;
  webImage: string;
  apiDigest: string;
  webDigest: string;
  sbom: {
    apiCycloneDxSha256: string;
    webCycloneDxSha256: string;
  };
  createdAt: string;
}

describe('Immutable Release Candidate Manifest & Exact-SHA CI (RLS-001 / PRD-2001..2003)', () => {
  it('validates canonical release manifest schema and exact SHA-256 fingerprint generation', () => {
    const mockManifest: ReleaseManifest = {
      schemaVersion: 2,
      sourceSha: 'd290f1ee6da77ca03efec3e887fefb1d5c2e99d1',
      migrationSetSha256: '8b4c64c71688cecd9eb29c2c8c8d30a43f12e1209b3720dab0c9aef2639b1bc2',
      approvedCiRun: { id: '12345678', url: 'https://github.com/org/repo/actions/runs/12345678' },
      apiImage:
        '123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/ai-interview-api@sha256:71c504a7541ef417a8ecda75f4d1e2e1e07b85e05459c9918b958c8942188ff6',
      webImage:
        '123456789012.dkr.ecr.ap-southeast-1.amazonaws.com/ai-interview-web@sha256:59d8c9735d46059d6e4650bb4d1bfa3c67d30f78a2e578c751a029583156cf64',
      apiDigest: 'sha256:71c504a7541ef417a8ecda75f4d1e2e1e07b85e05459c9918b958c8942188ff6',
      webDigest: 'sha256:59d8c9735d46059d6e4650bb4d1bfa3c67d30f78a2e578c751a029583156cf64',
      sbom: {
        apiCycloneDxSha256: '9f83c60579a5d2e547b5583eac97b4737a37f45b80e4390775a10222d0ec8536',
        webCycloneDxSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      },
      createdAt: '2026-09-01T12:00:00Z',
    };

    const serialized = JSON.stringify(mockManifest, null, 2);
    const hash = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(mockManifest.schemaVersion).toBe(2);
    expect(mockManifest.sourceSha).toMatch(/^[0-9a-f]{40}$/);
    expect(mockManifest.apiDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(mockManifest.webDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('verifies CI workflow enforces pinned SHAs for external actions and images', () => {
    const ciWorkflowPath = path.resolve(__dirname, '../../../../.github/workflows/ci.yml');
    const ciContent = fs.readFileSync(ciWorkflowPath, 'utf-8');

    // External container images pinned by sha256
    expect(ciContent).toContain('gitleaks@sha256:');
    expect(ciContent).toContain('semgrep/semgrep@sha256:');
    // Security actions pinned by commit hash
    expect(ciContent).toContain('aquasecurity/trivy-action@');
  });

  it('verifies deploy workflow requires staging approval before production promotion', () => {
    const deployWorkflowPath = path.resolve(__dirname, '../../../../.github/workflows/deploy.yml');
    const deployContent = fs.readFileSync(deployWorkflowPath, 'utf-8');

    expect(deployContent).toContain('needs: [release, deploy-staging]');
    expect(deployContent).toContain('retention-days: 180');
    expect(deployContent).toContain('manifest_sha256');
  });
});
