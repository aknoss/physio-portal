import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  applyMigrations,
  type PgFixture,
  startPostgres,
  stopPostgres,
} from '../../helpers/postgres.js';
import { PgPatientRepository } from '../../../src/modules/patients/PgPatientRepository.js';

let fixture: PgFixture;
let repo: PgPatientRepository;

beforeAll(async () => {
  fixture = await startPostgres();
  await applyMigrations(fixture.pool);
  repo = new PgPatientRepository(fixture.pool);
});

afterAll(async () => {
  await stopPostgres(fixture);
});

beforeEach(async () => {
  await fixture.pool.query('TRUNCATE patients CASCADE');
});

const sample = {
  fullName: 'Raiany Silva',
  address: 'Rua A, 123',
  phone: '+5521987654321',
  sessionPriceCents: 12000,
  notes: null as string | null,
};

describe('PgPatientRepository', () => {
  it('create persists a patient with active=true and maps columns', async () => {
    const p = await repo.create(sample);
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.fullName).toBe(sample.fullName);
    expect(p.address).toBe(sample.address);
    expect(p.phone).toBe(sample.phone);
    expect(p.sessionPriceCents).toBe(sample.sessionPriceCents);
    expect(p.notes).toBeNull();
    expect(p.active).toBe(true);
    expect(p.createdAt).toBeInstanceOf(Date);
  });

  it('create persists notes when provided', async () => {
    const p = await repo.create({ ...sample, notes: 'lombar' });
    expect(p.notes).toBe('lombar');
  });

  it('findById returns the patient', async () => {
    const created = await repo.create(sample);
    const found = await repo.findById(created.id);
    expect(found?.id).toBe(created.id);
  });

  it('findById returns null when not found', async () => {
    expect(await repo.findById('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('list returns all patients ordered by fullName', async () => {
    await repo.create({ ...sample, fullName: 'Carla' });
    await repo.create({ ...sample, fullName: 'Ana' });
    await repo.create({ ...sample, fullName: 'Bruno' });
    const list = await repo.list({});
    expect(list.map((p) => p.fullName)).toEqual(['Ana', 'Bruno', 'Carla']);
  });

  it('list filters by active', async () => {
    const ana = await repo.create({ ...sample, fullName: 'Ana' });
    await repo.create({ ...sample, fullName: 'Bruno' });
    await repo.deactivate(ana.id);
    expect((await repo.list({ active: true })).map((p) => p.fullName)).toEqual(['Bruno']);
    expect((await repo.list({ active: false })).map((p) => p.fullName)).toEqual(['Ana']);
  });

  it('list searches by name (case-insensitive substring)', async () => {
    await repo.create({ ...sample, fullName: 'Ana Souza' });
    await repo.create({ ...sample, fullName: 'Bruno Lima' });
    const list = await repo.list({ search: 'BRU' });
    expect(list.map((p) => p.fullName)).toEqual(['Bruno Lima']);
  });

  it('list combines active and search filters', async () => {
    const ana = await repo.create({ ...sample, fullName: 'Ana' });
    await repo.create({ ...sample, fullName: 'Bruno' });
    await repo.deactivate(ana.id);
    const list = await repo.list({ active: true, search: 'a' });
    expect(list.map((p) => p.fullName)).toEqual([]);
  });

  it('update changes only provided fields', async () => {
    const created = await repo.create(sample);
    const updated = await repo.update(created.id, {
      fullName: 'Novo Nome',
      sessionPriceCents: 15000,
    });
    expect(updated?.fullName).toBe('Novo Nome');
    expect(updated?.sessionPriceCents).toBe(15000);
    expect(updated?.address).toBe(sample.address);
    expect(updated?.phone).toBe(sample.phone);
  });

  it('update can set notes back to null', async () => {
    const created = await repo.create({ ...sample, notes: 'antiga' });
    const updated = await repo.update(created.id, { notes: null });
    expect(updated?.notes).toBeNull();
  });

  it('update can toggle active', async () => {
    const created = await repo.create(sample);
    const off = await repo.update(created.id, { active: false });
    expect(off?.active).toBe(false);
    const on = await repo.update(created.id, { active: true });
    expect(on?.active).toBe(true);
  });

  it('update returns the unchanged patient when no fields are provided', async () => {
    const created = await repo.create(sample);
    const updated = await repo.update(created.id, {});
    expect(updated?.id).toBe(created.id);
    expect(updated?.fullName).toBe(sample.fullName);
  });

  it('update returns null when the patient does not exist', async () => {
    const updated = await repo.update('00000000-0000-0000-0000-000000000000', {
      fullName: 'X',
    });
    expect(updated).toBeNull();
  });

  it('update with empty input returns null when patient is missing', async () => {
    const updated = await repo.update('00000000-0000-0000-0000-000000000000', {});
    expect(updated).toBeNull();
  });

  it('deactivate flips active=false and returns the patient', async () => {
    const created = await repo.create(sample);
    const off = await repo.deactivate(created.id);
    expect(off?.active).toBe(false);
  });

  it('deactivate returns null when patient is missing', async () => {
    expect(await repo.deactivate('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
