import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, type PgFixture, startPostgres, stopPostgres } from '../../helpers/postgres.js';
import { PgUserRepository } from '../../../src/modules/auth/PgUserRepository.js';

let fixture: PgFixture;
let repo: PgUserRepository;

beforeAll(async () => {
  fixture = await startPostgres();
  await applyMigrations(fixture.pool);
  repo = new PgUserRepository(fixture.pool);
});

afterAll(async () => {
  await stopPostgres(fixture);
});

beforeEach(async () => {
  await fixture.pool.query('TRUNCATE users CASCADE');
});

const sample = {
  email: 'fisio@example.com',
  passwordHash: 'hashed',
  fullName: 'Raiany',
  cref: 'CREFITO-99999',
};

describe('PgUserRepository', () => {
  it('create persists the user and maps snake_case columns to camelCase', async () => {
    const user = await repo.create(sample);
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.email).toBe(sample.email);
    expect(user.passwordHash).toBe(sample.passwordHash);
    expect(user.fullName).toBe(sample.fullName);
    expect(user.cref).toBe(sample.cref);
    expect(user.signatureUrl).toBeNull();
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('findByEmail returns the user when present', async () => {
    const created = await repo.create(sample);
    const found = await repo.findByEmail(sample.email);
    expect(found?.id).toBe(created.id);
  });

  it('findByEmail returns null when not found', async () => {
    expect(await repo.findByEmail('missing@example.com')).toBeNull();
  });

  it('findById returns the user when present', async () => {
    const created = await repo.create(sample);
    const found = await repo.findById(created.id);
    expect(found?.email).toBe(sample.email);
  });

  it('findById returns null when not found', async () => {
    expect(await repo.findById('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('updateProfile updates fullName and cref, returning the updated user', async () => {
    const created = await repo.create(sample);
    const updated = await repo.updateProfile(created.id, {
      fullName: 'Raiany',
      cref: 'CREFITO-99999-RJ',
    });
    expect(updated?.fullName).toBe('Raiany');
    expect(updated?.cref).toBe('CREFITO-99999-RJ');
    expect(updated?.email).toBe(sample.email);
  });

  it('updateSignatureUrl stores the URL and returns the updated user', async () => {
    const created = await repo.create(sample);
    const updated = await repo.updateSignatureUrl(created.id, '/uploads/signature.png');
    expect(updated?.signatureUrl).toBe('/uploads/signature.png');
  });

  it('updateProfile returns null when the user does not exist', async () => {
    expect(
      await repo.updateProfile('00000000-0000-0000-0000-000000000000', {
        fullName: 'X',
        cref: 'Y',
      }),
    ).toBeNull();
  });

  it('updateSignatureUrl returns null when the user does not exist', async () => {
    expect(
      await repo.updateSignatureUrl('00000000-0000-0000-0000-000000000000', '/u/sig.png'),
    ).toBeNull();
  });
});
