import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class TextExtractorService {
  private readonly logger = new Logger(TextExtractorService.name);

  /**
   * Extracts raw text from binary buffer based on mime type or file extension
   */
  async extractText(buffer: Buffer, fileType: string, fileName?: string): Promise<string> {
    const ext = fileType.toLowerCase();

    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('File exceeds the maximum allowed size of 5MB');
    }

    try {
      if (ext === 'pdf' || ext.includes('pdf')) {
        return await this.extractFromPdf(buffer);
      } else if (ext === 'docx' || ext.includes('docx') || ext.includes('wordprocessingml')) {
        return await this.extractFromDocx(buffer);
      } else if (ext === 'text' || ext === 'txt' || ext.includes('plain')) {
        return buffer.toString('utf-8');
      } else {
        // Fallback: try utf-8 string
        return buffer.toString('utf-8');
      }
    } catch (err: any) {
      this.logger.error(`Failed to extract text from file ${fileName || 'unnamed'}: ${err.message}`);
      throw new BadRequestException(`Unable to parse file content: ${err.message}`);
    }
  }

  private async extractFromPdf(buffer: Buffer): Promise<string> {
    const parseFn = (pdfParse as any).default || pdfParse;
    const data = await parseFn(buffer);
    return data.text || '';
  }

  private async extractFromDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  /**
   * PII Scrubber: Replaces identifiable phone numbers, emails, and physical addresses
   * before passing into LLM context.
   */
  maskPii(text: string): string {
    if (!text) return '';

    let scrubbed = text;

    // 1. Email pattern
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    scrubbed = scrubbed.replace(emailRegex, '[EMAIL_MASKED]');

    // 2. Phone pattern (VN & international)
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]*)?\(?\d{2,4}\)?[-.\s]*\d{2,4}[-.\s]*\d{2,4}[-.\s]*\d{3,4}|\b0[3|5|7|8|9]\d{8}\b|\b0\d{9,10}\b/g;
    scrubbed = scrubbed.replace(phoneRegex, '[PHONE_MASKED]');

    // 3. Address pattern (VN & International common street formats)
    const addressRegex = /\b\d{1,5}\s+[A-Za-z0-9\s,.-]+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|District|Ward|Quận|Phường|Hà Nội|TP\.?HCM|Hồ Chí Minh|Đà Nẵng)\b/gi;
    scrubbed = scrubbed.replace(addressRegex, '[ADDRESS_MASKED]');

    return scrubbed;
  }
}
