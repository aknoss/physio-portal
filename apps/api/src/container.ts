import 'reflect-metadata';
import express, { type Express } from 'express';
import { container as rootContainer, type DependencyContainer } from 'tsyringe';
import type { Pool } from 'pg';
import { AuthService } from './modules/auth/AuthService.js';
import { createAuthRouter } from './modules/auth/AuthController.js';
import { PgUserRepository } from './modules/auth/PgUserRepository.js';
import type { UserRepository } from './modules/auth/UserRepository.js';
import { BcryptPasswordHasher } from './shared/crypto/BcryptPasswordHasher.js';
import type { PasswordHasher } from './shared/crypto/PasswordHasher.js';
import { errorHandler } from './shared/middleware/errorHandler.js';
import { LocalFileStorage } from './shared/storage/LocalFileStorage.js';
import type { FileStorage } from './shared/storage/FileStorage.js';
import { JwtTokenSigner } from './shared/tokens/JwtTokenSigner.js';
import type { TokenSigner } from './shared/tokens/TokenSigner.js';

export const TOKENS = {
  Pool: 'Pool',
  UserRepository: 'UserRepository',
  PasswordHasher: 'PasswordHasher',
  TokenSigner: 'TokenSigner',
  FileStorage: 'FileStorage',
  AuthService: 'AuthService',
} as const;

export type ContainerConfig = {
  pool: Pool;
  jwtSecret: string;
  uploadsDir: string;
  uploadsPublicPrefix: string;
};

export function buildContainer(config: ContainerConfig): DependencyContainer {
  const c = rootContainer.createChildContainer();
  c.register<Pool>(TOKENS.Pool, { useValue: config.pool });
  c.register<PasswordHasher>(TOKENS.PasswordHasher, {
    useFactory: () => new BcryptPasswordHasher(),
  });
  c.register<TokenSigner>(TOKENS.TokenSigner, {
    useValue: new JwtTokenSigner(config.jwtSecret),
  });
  c.register<FileStorage>(TOKENS.FileStorage, {
    useValue: new LocalFileStorage(config.uploadsDir, config.uploadsPublicPrefix),
  });
  c.register<UserRepository>(TOKENS.UserRepository, {
    useFactory: (r) => new PgUserRepository(r.resolve<Pool>(TOKENS.Pool)),
  });
  c.register<AuthService>(TOKENS.AuthService, {
    useFactory: (r) =>
      new AuthService(
        r.resolve<UserRepository>(TOKENS.UserRepository),
        r.resolve<PasswordHasher>(TOKENS.PasswordHasher),
        r.resolve<TokenSigner>(TOKENS.TokenSigner),
        r.resolve<FileStorage>(TOKENS.FileStorage),
      ),
  });
  return c;
}

export function buildApp(config: ContainerConfig): Express {
  const c = buildContainer(config);
  const authService = c.resolve<AuthService>(TOKENS.AuthService);
  const signer = c.resolve<TokenSigner>(TOKENS.TokenSigner);

  const app = express();
  app.use(express.json());
  app.use(createAuthRouter(authService, signer));
  app.use(errorHandler);
  return app;
}
