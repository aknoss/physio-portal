import './db/pgTypes.js';
import express, { type Express } from 'express';
import type { Pool } from 'pg';
import { AuthService } from './modules/auth/AuthService.js';
import { createAuthRouter } from './modules/auth/AuthController.js';
import { PgUserRepository } from './modules/auth/PgUserRepository.js';
import { PgPatientRepository } from './modules/patients/PgPatientRepository.js';
import { PatientService } from './modules/patients/PatientService.js';
import { createPatientRouter } from './modules/patients/PatientController.js';
import { PgScheduleRepository } from './modules/schedule/PgScheduleRepository.js';
import { ScheduleService } from './modules/schedule/ScheduleService.js';
import { createScheduleRouter } from './modules/schedule/ScheduleController.js';
import { PgSessionRepository } from './modules/sessions/PgSessionRepository.js';
import { SessionService } from './modules/sessions/SessionService.js';
import { createSessionRouter } from './modules/sessions/SessionController.js';
import { PgReportRepository } from './modules/reports/PgReportRepository.js';
import { ReportService } from './modules/reports/ReportService.js';
import { createReportRouter } from './modules/reports/ReportController.js';
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
  const scheduleRepository = new PgScheduleRepository(config.pool);
  const sessionRepository = new PgSessionRepository(config.pool);
  const reportRepository = new PgReportRepository(config.pool);

  const authService = new AuthService(userRepository, passwordHasher, tokenSigner, fileStorage);
  const patientService = new PatientService(patientRepository);
  const scheduleService = new ScheduleService(scheduleRepository, patientRepository);
  const sessionService = new SessionService(
    sessionRepository,
    scheduleRepository,
    patientRepository,
  );
  const reportService = new ReportService(reportRepository, patientRepository);

  const app = express();
  app.use(express.json());
  app.use(createAuthRouter(authService, tokenSigner));
  app.use(createPatientRouter(patientService, tokenSigner));
  app.use(createScheduleRouter(scheduleService, tokenSigner));
  app.use(createSessionRouter(sessionService, tokenSigner));
  app.use(createReportRouter(reportService, tokenSigner));
  app.use(errorHandler);
  return app;
}
