import { Router } from 'express';
import multer from 'multer';
import { LoginRequest, UpdateProfileRequest, type UserDto } from '@physio-portal/contracts';
import { ValidationError } from '../../shared/http/HttpError.js';
import { asyncHandler } from '../../shared/http/asyncHandler.js';
import { createAuthMiddleware } from '../../shared/middleware/authMiddleware.js';
import { validate } from '../../shared/middleware/validate.js';
import type { TokenSigner } from '../../shared/tokens/TokenSigner.js';
import type { AuthService } from './AuthService.js';
import type { User } from './User.js';

function toDto(u: User): UserDto {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    cref: u.cref,
    signatureUrl: u.signatureUrl,
  };
}

export function createAuthRouter(service: AuthService, signer: TokenSigner): Router {
  const r = Router();
  const requireAuth = createAuthMiddleware(signer);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'image/png') {
        cb(new ValidationError('Signature must be a PNG'));
        return;
      }
      cb(null, true);
    },
  });

  r.post(
    '/auth/login',
    validate(LoginRequest),
    asyncHandler(async (req, res) => {
      const { email, password } = req.body as LoginRequest;
      const result = await service.login(email, password);
      res.json({ token: result.token, user: toDto(result.user) });
    }),
  );

  r.get(
    '/auth/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = await service.getMe(req.userId!);
      res.json(toDto(user));
    }),
  );

  r.patch(
    '/auth/me',
    requireAuth,
    validate(UpdateProfileRequest),
    asyncHandler(async (req, res) => {
      const updated = await service.updateProfile(req.userId!, req.body as UpdateProfileRequest);
      res.json(toDto(updated));
    }),
  );

  r.post(
    '/auth/me/signature',
    requireAuth,
    upload.single('signature'),
    asyncHandler(async (req, res) => {
      if (!req.file) throw new ValidationError('Missing signature file');
      const updated = await service.setSignature(req.userId!, req.file.buffer);
      res.json(toDto(updated));
    }),
  );

  return r;
}
