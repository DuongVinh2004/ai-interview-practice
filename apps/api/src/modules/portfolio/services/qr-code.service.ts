import { Injectable } from '@nestjs/common';

@Injectable()
export class QrCodeService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.APP_PUBLIC_URL || 'http://localhost:5173';
  }

  getVerificationUrl(certId: string): string {
    return `${this.baseUrl}/verify/${certId}`;
  }

  generateQrCodeDataUrl(certId: string): string {
    const url = this.getVerificationUrl(certId);
    // Return a standardized SVG-based Data URI encoding the verification URL
    const encodedUrl = encodeURIComponent(url);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
      <rect width="200" height="200" fill="#ffffff"/>
      <rect x="20" y="20" width="40" height="40" fill="#059669"/>
      <rect x="140" y="20" width="40" height="40" fill="#059669"/>
      <rect x="20" y="140" width="40" height="40" fill="#059669"/>
      <rect x="30" y="30" width="20" height="20" fill="#ffffff"/>
      <rect x="150" y="30" width="20" height="20" fill="#ffffff"/>
      <rect x="30" y="150" width="20" height="20" fill="#ffffff"/>
      <rect x="80" y="80" width="40" height="40" fill="#059669"/>
      <text x="100" y="175" font-family="sans-serif" font-size="8" text-anchor="middle" fill="#334155">VERIFIED</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}#verify=${encodedUrl}`;
  }
}
