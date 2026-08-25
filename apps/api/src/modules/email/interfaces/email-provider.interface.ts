export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailSendOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailSendResponse {
  id: string;
  provider: string;
  success: boolean;
}

export interface EmailProvider {
  readonly name: string;
  sendEmail(options: EmailSendOptions): Promise<EmailSendResponse>;
}
