import { Router } from 'express';
import { type ScheduleDto, UpsertScheduleRequest } from '@physio-portal/contracts';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createAuthMiddleware } from '../../shared/middleware/authMiddleware.js';
import { validate } from '../../shared/middleware/validate.js';
import type { TokenSigner } from '../../shared/tokens/TokenSigner.js';
import type { Schedule } from './Schedule.js';
import type { ScheduleService } from './ScheduleService.js';

function toDto(s: Schedule): ScheduleDto {
  return {
    patientId: s.patientId,
    weekdays: s.weekdays,
    startDate: s.startDate,
    endDate: s.endDate,
  };
}

export function createScheduleRouter(service: ScheduleService, signer: TokenSigner): Router {
  const r = Router();
  r.use(createAuthMiddleware(signer));

  r.put(
    '/patients/:id/schedule',
    validate(UpsertScheduleRequest),
    asyncHandler(async (req, res) => {
      const id = req.params.id as string;
      const body = req.body as UpsertScheduleRequest;
      const schedule = await service.upsert(id, {
        weekdays: body.weekdays,
        startDate: body.startDate,
        endDate: body.endDate ?? null,
      });
      res.json(toDto(schedule));
    }),
  );

  r.get(
    '/patients/:id/schedule',
    asyncHandler(async (req, res) => {
      const id = req.params.id as string;
      const schedule = await service.getByPatientId(id);
      res.json(toDto(schedule));
    }),
  );

  return r;
}
