import express, { type Express } from 'express';
import type { Pool } from 'pg';
import { AuthService } from './modules/auth/AuthService.js';
import { createAuthRouter } from './modules/auth/AuthController.js';
import { PgUserRepository } from './modules/auth/PgUserRepository.js';
import { PgPatientRepository } from './modules/patients/PgPatientRepository.js';
import { PatientService } from './modules/patients/PatientService.js';
import { createPatientRouter } from './modules/patients/PatientController.js';
import { BcryptPasswordHasher } from './shared/crypto/BcryptPasswordHasher.js';
import { errorHandler } from './shared/middleware/errorHandler.js';
import { LocalFileStorage } from './shared/storage/LocalFileStorage.js';
import { JwtTokenSigner } from './shared/tokens/JwtTokenSigner.js';

export type AppConfig = {
  pool: Pool;
  jwtSecret: string;
  uploadsDir: string;
  uploadsPublicPrefix: string;
};

export function buildApp(config: AppConfig): Express {
  const passwordHasher = new BcryptPasswordHasher();
  const tokenSigner = new JwtTokenSigner(config.jwtSecret);
  const fileStorage = new LocalFileStorage(config.uploadsDir, config.uploadsPublicPrefix);

  const userRepository = new PgUserRepository(config.pool);
  const patientRepository = new PgPatientRepository(config.pool);

  const authService = new AuthService(userRepository, passwordHasher, tokenSigner, fileStorage);
  const patientService = new PatientService(patientRepository);

  const app = express();
  app.use(express.json());
  app.use(createAuthRouter(authService, tokenSigner));
  app.use(createPatientRouter(patientService, tokenSigner));
  app.use(errorHandler);
  return app;
}
