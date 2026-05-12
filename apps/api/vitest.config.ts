import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',
        'src/db/migrate-cli.ts',
        'src/db/seed-cli.ts',
        'src/db/migrations/**',
        'src/**/*.d.ts',
        // type-only interface files (no runtime code) — listed in plan exclusions
        'src/shared/clock/Clock.ts',
        'src/shared/crypto/PasswordHasher.ts',
        'src/shared/storage/FileStorage.ts',
        'src/shared/tokens/TokenSigner.ts',
        'src/modules/auth/User.ts',
        'src/modules/auth/UserRepository.ts',
        'src/modules/patients/Patient.ts',
        'src/modules/patients/PatientRepository.ts',
        'src/modules/schedule/Schedule.ts',
        'src/modules/schedule/ScheduleRepository.ts',
        'src/modules/sessions/Session.ts',
        'src/modules/sessions/SessionRepository.ts',
        'src/modules/reports/ReportRepository.ts',
        'src/infra/pdf/PdfRenderer.ts',
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
