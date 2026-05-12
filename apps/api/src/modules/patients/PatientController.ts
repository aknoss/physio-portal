import { Router } from 'express';
import {
  CreatePatientRequest,
  ListPatientsQuery,
  UpdatePatientRequest,
  type PatientDto,
} from '@physio-portal/contracts';
import { ValidationError } from '../../shared/http/HttpError.js';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createAuthMiddleware } from '../../shared/middleware/authMiddleware.js';
import { validate } from '../../shared/middleware/validate.js';
import type { TokenSigner } from '../../shared/tokens/TokenSigner.js';
import type { Patient } from './Patient.js';
import type {
  CreatePatientInput,
  ListPatientsFilter,
  UpdatePatientInput,
} from './PatientRepository.js';
import type { PatientService } from './PatientService.js';

function toDto(p: Patient): PatientDto {
  return {
    id: p.id,
    fullName: p.fullName,
    address: p.address,
    phone: p.phone,
    sessionPriceCents: p.sessionPriceCents,
    notes: p.notes,
    active: p.active,
    createdAt: p.createdAt.toISOString(),
  };
}

export function createPatientRouter(service: PatientService, signer: TokenSigner): Router {
  const r = Router();
  const requireAuth = createAuthMiddleware(signer);

  r.use(requireAuth);

  r.get(
    '/patients',
    asyncHandler(async (req, res) => {
      const parsed = ListPatientsQuery.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.issues);
      }
      const filter: ListPatientsFilter = {};
      if (parsed.data.active !== undefined) filter.active = parsed.data.active;
      if (parsed.data.search !== undefined) filter.search = parsed.data.search;
      const patients = await service.list(filter);
      res.json(patients.map(toDto));
    }),
  );

  r.post(
    '/patients',
    validate(CreatePatientRequest),
    asyncHandler(async (req, res) => {
      const body = req.body as CreatePatientRequest;
      const input: CreatePatientInput = {
        fullName: body.fullName,
        address: body.address,
        phone: body.phone,
        sessionPriceCents: body.sessionPriceCents,
        notes: body.notes ?? null,
      };
      const created = await service.create(input);
      res.status(201).json(toDto(created));
    }),
  );

  r.get(
    '/patients/:id',
    asyncHandler(async (req, res) => {
      const id = req.params.id as string;
      const patient = await service.getById(id);
      res.json(toDto(patient));
    }),
  );

  r.patch(
    '/patients/:id',
    validate(UpdatePatientRequest),
    asyncHandler(async (req, res) => {
      const id = req.params.id as string;
      const body = req.body as UpdatePatientRequest;
      const input: UpdatePatientInput = {};
      if (body.fullName !== undefined) input.fullName = body.fullName;
      if (body.address !== undefined) input.address = body.address;
      if (body.phone !== undefined) input.phone = body.phone;
      if (body.sessionPriceCents !== undefined) input.sessionPriceCents = body.sessionPriceCents;
      if (body.notes !== undefined) input.notes = body.notes;
      if (body.active !== undefined) input.active = body.active;
      const updated = await service.update(id, input);
      res.json(toDto(updated));
    }),
  );

  r.delete(
    '/patients/:id',
    asyncHandler(async (req, res) => {
      const id = req.params.id as string;
      const deactivated = await service.deactivate(id);
      res.json(toDto(deactivated));
    }),
  );

  return r;
}
