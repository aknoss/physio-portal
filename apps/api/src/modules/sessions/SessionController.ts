import { Router } from 'express';
import { GenerateSessionsRequest, type SessionDto } from '@physio-portal/contracts';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createAuthMiddleware } from '../../shared/middleware/authMiddleware.js';
import { validate } from '../../shared/middleware/validate.js';
import type { TokenSigner } from '../../shared/tokens/TokenSigner.js';
import type { Session } from './Session.js';
import type { SessionService } from './SessionService.js';

function toDto(s: Session): SessionDto {
  return {
    id: s.id,
    patientId: s.patientId,
    date: s.date,
    status: s.status,
    priceCents: s.priceCents,
    note: s.note,
  };
}

export function createSessionRouter(service: SessionService, signer: TokenSigner): Router {
  const r = Router();
  r.use(createAuthMiddleware(signer));

  r.post(
    '/patients/:id/sessions/generate',
    validate(GenerateSessionsRequest),
    asyncHandler(async (req, res) => {
      const id = req.params.id as string;
      const body = req.body as GenerateSessionsRequest;
      const sessions = await service.generate(id, body.from, body.to);
      res.status(201).json(sessions.map(toDto));
    }),
  );

  return r;
}
