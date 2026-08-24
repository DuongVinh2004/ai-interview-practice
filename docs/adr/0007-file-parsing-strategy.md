# ADR 0007: In-Memory Resume & JD Parsing Strategy with PII Minimization

## Status

Accepted

## Context

Feature F004 requires candidates to upload resumes (PDF, DOCX, TXT) and input job descriptions (JD) to produce tailored interview questions and gap analysis. Storing unencrypted raw resumes or exposing personal identifiable information (PII such as phone numbers, emails, home addresses) to third-party LLM providers presents significant GDPR compliance, privacy, and security risks.

## Decision

1. We use `pdf-parse` for PDF files and `mammoth` for DOCX files to extract text in-memory.
2. All parsing and extraction operations are performed in-memory without persisting raw binary files to disk.
3. Before structured profile extraction or LLM prompt generation, raw text passes through a dedicated PII scrubber regex layer that masks phone numbers, emails, physical addresses, and social security identifiers.
4. User documents and parsed profiles have a strict 30-day retention TTL (`expiresAt`) with automatic hard-deletion, while candidates can delete documents on demand at any time.
5. In development/test environments, mock parsing pipelines allow end-to-end testing without external document dependencies.

## Consequences

- **Positive**: Compliant with GDPR data minimization principles, prevents accidental PII leaks to AI providers, zero local disk persistence vulnerability.
- **Negative**: Scanned image PDFs without text layer require future OCR extensions (out of current MVP scope).
