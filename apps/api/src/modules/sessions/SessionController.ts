import { Router } from 'express';
import {
  GenerateSessionsRequest,
  UpdateSessionRequest,
  type SessionDto,
} from '@physio-portal/contracts';
import { ValidationError } from '../../shared/http/HttpError.js';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createAuthMiddleware } from '../../shared/middleware/authMiddleware.js';
import { validate } from '../../shared/middleware/validate.js';
import type { TokenSigner } from '../../shared/tokens/TokenSigner.js';
import type { Session } from './Session.js';
import type { UpdateSessionInput } from './SessionRepository.js';
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

  r.get(
    '/patients/:id/sessions',
    asyncHandler(async (req, res) => {
      const parsed = GenerateSessionsRequest.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.issues);
      }
      const id = req.params.id as string;
      const sessions = await service.listInRange(id, parsed.data.from, parsed.data.to);
      res.json(sessions.map(toDto));
    }),
  );

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

  r.patch(
    '/sessions/:id',
    validate(UpdateSessionRequest),
    asyncHandler(async (req, res) => {
      const id = req.params.id as string;
      const body = req.body as UpdateSessionRequest;
      const input: UpdateSessionInput = {};
      if (body.status !== undefined) input.status = body.status;
      if (body.note !== undefined) input.note = body.note;
      const updated = await service.updateStatus(id, input);
      res.json(toDto(updated));
    }),
  );

  return r;
}
