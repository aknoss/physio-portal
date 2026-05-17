import './db/pgTypes.js';
import { join } from 'node:path';
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
import { SystemClock } from './shared/clock/SystemClock.js';
import { errorHandler } from './shared/middleware/errorHandler.js';
import { LocalFileStorage } from './shared/storage/LocalFileStorage.js';
import { JwtTokenSigner } from './shared/tokens/JwtTokenSigner.js';
import { PdfKitRenderer } from './infra/pdf/PdfKitRenderer.js';

export type AppConfig = {
  pool: Pool;
  jwtSecret: string;
  uploadsDir: string;
  uploadsPublicPrefix: string;
  webDistDir?: string;
};

export function buildApp(config: AppConfig): Express {
  const passwordHasher = new BcryptPasswordHasher();
  const tokenSigner = new JwtTokenSigner(config.jwtSecret);
  const fileStorage = new LocalFileStorage(config.uploadsDir, config.uploadsPublicPrefix);
  const pdfRenderer = new PdfKitRenderer();
  const clock = new SystemClock();

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
  const reportService = new ReportService(
    reportRepository,
    patientRepository,
    userRepository,
    sessionRepository,
    fileStorage,
    pdfRenderer,
    clock,
  );

  const app = express();
  app.use(express.json());
  app.use(config.uploadsPublicPrefix, express.static(config.uploadsDir));
  app.use('/api', createAuthRouter(authService, tokenSigner));
  app.use('/api', createPatientRouter(patientService, tokenSigner));
  app.use('/api', createScheduleRouter(scheduleService, tokenSigner));
  app.use('/api', createSessionRouter(sessionService, tokenSigner));
  app.use('/api', createReportRouter(reportService, tokenSigner));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  if (config.webDistDir) {
    const webDistDir = config.webDistDir;
    app.use(express.static(webDistDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(join(webDistDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
