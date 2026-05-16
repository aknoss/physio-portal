import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { PdfKitRenderer } from '../../../src/infra/pdf/PdfKitRenderer.js';
import type { MonthlyReportInput } from '../../../src/infra/pdf/PdfRenderer.js';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse') as {
  PDFParse: new (options: { data: Buffer }) => {
    getText(): Promise<{ text: string }>;
  };
};

async function extractText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  return text;
}

const baseInput: MonthlyReportInput = {
  physio: { fullName: 'Raiany', cref: 'CREFITO-12345' },
  signature: null,
  patient: {
    fullName: 'Pedro Silva',
    address: 'Rua A, 123',
    phone: '+5521987654321',
  },
  month: '2026-03',
  sessions: [
    { date: '2026-03-02', priceCents: 12000 },
    { date: '2026-03-09', priceCents: 12000 },
    { date: '2026-03-16', priceCents: 12000 },
    { date: '2026-03-23', priceCents: 12000 },
  ],
  totalCents: 48000,
  issuedAt: new Date(Date.UTC(2026, 3, 1, 12, 0, 0)),
};

describe('PdfKitRenderer.renderMonthlyReport', () => {
  it('produces a valid PDF buffer', async () => {
    const renderer = new PdfKitRenderer();
    const buffer = await renderer.renderMonthlyReport(baseInput);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('embeds physio data, patient data, sessions table and the total in BRL', async () => {
    const renderer = new PdfKitRenderer();
    const buffer = await renderer.renderMonthlyReport(baseInput);
    const text = await extractText(buffer);
    expect(text).toContain('Raiany');
    expect(text).toContain('CREFITO-12345');
    expect(text).toContain('Pedro Silva');
    expect(text).toContain('Rua A, 123');
    expect(text).toContain('+5521987654321');
    expect(text).toContain('2026-03');
    expect(text).toContain('02/03/2026');
    expect(text).toContain('R$ 120,00');
    expect(text).toContain('R$ 480,00');
  });

  it('embeds the signature image when provided', async () => {
    const renderer = new PdfKitRenderer();
    // 1x1 transparent PNG (smallest valid PNG)
    const signature = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );
    const buffer = await renderer.renderMonthlyReport({ ...baseInput, signature });
    // pdf-parse can't easily assert images, but the PDF must contain an embedded image object
    expect(buffer.includes(Buffer.from('/Image'))).toBe(true);
  });

  it('renders a "sem sessões" placeholder when there are no sessions', async () => {
    const renderer = new PdfKitRenderer();
    const buffer = await renderer.renderMonthlyReport({
      ...baseInput,
      sessions: [],
      totalCents: 0,
    });
    const text = await extractText(buffer);
    expect(text.toLowerCase()).toContain('nenhuma sessão');
    expect(text).toContain('R$ 0,00');
  });

  it('includes the issued date in dd/mm/yyyy format', async () => {
    const renderer = new PdfKitRenderer();
    const buffer = await renderer.renderMonthlyReport(baseInput);
    const text = await extractText(buffer);
    expect(text).toContain('01/04/2026');
  });
});
