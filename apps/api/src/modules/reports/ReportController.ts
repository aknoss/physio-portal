import { Router } from 'express';
import { MonthlyReportQuery, ReportRangeQuery } from '@physio-portal/contracts';
import { ValidationError } from '../../shared/http/HttpError.js';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createAuthMiddleware } from '../../shared/middleware/authMiddleware.js';
import type { TokenSigner } from '../../shared/tokens/TokenSigner.js';
import type { ReportService } from './ReportService.js';

export function createReportRouter(service: ReportService, signer: TokenSigner): Router {
  const r = Router();
  r.use(createAuthMiddleware(signer));

  r.get(
    '/reports/summary',
    asyncHandler(async (req, res) => {
      const parsed = ReportRangeQuery.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.issues);
      }
      const summary = await service.summary(parsed.data.from, parsed.data.to);
      res.json(summary);
    }),
  );

  r.get(
    '/reports/ranking',
    asyncHandler(async (req, res) => {
      const parsed = ReportRangeQuery.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.issues);
      }
      const ranking = await service.ranking(parsed.data.from, parsed.data.to);
      res.json(ranking);
    }),
  );

  r.get(
    '/reports/patient/:id',
    asyncHandler(async (req, res) => {
      const parsed = ReportRangeQuery.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.issues);
      }
      const id = req.params.id as string;
      const summary = await service.patientSummary(id, parsed.data.from, parsed.data.to);
      res.json(summary);
    }),
  );

  r.get(
    '/reports/patient/:id/monthly.pdf',
    asyncHandler(async (req, res) => {
      const parsed = MonthlyReportQuery.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.issues);
      }
      const id = req.params.id as string;
      const userId = req.userId as string;
      const pdf = await service.monthlyReport(userId, id, parsed.data.month);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="monthly-${id}-${parsed.data.month}.pdf"`,
      );
      res.send(pdf);
    }),
  );

  return r;
}
