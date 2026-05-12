import PDFDocument from 'pdfkit';
import type { MonthlyReportInput, PdfRenderer } from './PdfRenderer.js';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

function formatIsoDateBR(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function formatIssuedAtBR(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

export class PdfKitRenderer implements PdfRenderer {
  async renderMonthlyReport(input: MonthlyReportInput): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fontSize(16).text('Relatório Mensal de Atendimentos', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Fisioterapeuta: ${input.physio.fullName}`);
    doc.text(`CREF: ${input.physio.cref}`);
    doc.moveDown();

    doc.fontSize(12).text('Paciente');
    doc.fontSize(11).text(`Nome: ${input.patient.fullName}`);
    doc.text(`Endereço: ${input.patient.address}`);
    doc.text(`Telefone: ${input.patient.phone}`);
    doc.moveDown();

    doc.fontSize(12).text(`Mês de referência: ${input.month}`);
    doc.moveDown(0.5);

    if (input.sessions.length === 0) {
      doc.fontSize(11).text('Nenhuma sessão realizada no período.');
    } else {
      doc.fontSize(12).text('Sessões realizadas');
      doc.moveDown(0.3);
      doc.fontSize(11);
      for (const s of input.sessions) {
        doc.text(`${formatIsoDateBR(s.date)}   ${formatBRL(s.priceCents)}`);
      }
    }
    doc.moveDown();
    doc.fontSize(12).text(`Total: ${formatBRL(input.totalCents)}`, { align: 'right' });

    doc.moveDown(2);
    if (input.signature) {
      doc.image(input.signature, { width: 120 });
      doc.moveDown(0.3);
    }
    doc.fontSize(10).text(`Emitido em ${formatIssuedAtBR(input.issuedAt)}`);

    doc.end();
    return done;
  }
}
