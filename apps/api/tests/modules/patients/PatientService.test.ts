import { beforeEach, describe, expect, it } from 'vitest';
import { PatientService } from '../../../src/modules/patients/PatientService.js';
import { NotFoundError } from '../../../src/shared/http/HttpError.js';
import { InMemoryPatientRepository } from '../../helpers/fakes.js';

let repo: InMemoryPatientRepository;
let service: PatientService;

const baseInput = {
  fullName: 'Raiany Silva',
  address: 'Rua A, 123',
  phone: '+5521987654321',
  sessionPriceCents: 12000,
  notes: null as string | null,
};

beforeEach(() => {
  repo = new InMemoryPatientRepository();
  service = new PatientService(repo);
});

describe('PatientService.create', () => {
  it('creates a patient with active=true by default', async () => {
    const created = await service.create(baseInput);
    expect(created.id).toBeDefined();
    expect(created.active).toBe(true);
    expect(created.fullName).toBe('Raiany Silva');
    expect(created.notes).toBeNull();
  });

  it('persists notes when provided', async () => {
    const created = await service.create({ ...baseInput, notes: 'lombar' });
    expect(created.notes).toBe('lombar');
  });
});

describe('PatientService.getById', () => {
  it('returns the patient when found', async () => {
    const created = await service.create(baseInput);
    const found = await service.getById(created.id);
    expect(found.id).toBe(created.id);
  });

  it('throws NotFound when the patient does not exist', async () => {
    await expect(
      service.getById('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('PatientService.list', () => {
  beforeEach(async () => {
    await service.create({ ...baseInput, fullName: 'Ana Souza' });
    await service.create({ ...baseInput, fullName: 'Bruno Lima' });
    const carla = await service.create({ ...baseInput, fullName: 'Carla Dias' });
    await service.deactivate(carla.id);
  });

  it('returns all patients when no filter is given', async () => {
    const list = await service.list({});
    expect(list).toHaveLength(3);
  });

  it('filters by active=true', async () => {
    const list = await service.list({ active: true });
    expect(list.map((p) => p.fullName)).toEqual(['Ana Souza', 'Bruno Lima']);
  });

  it('filters by active=false', async () => {
    const list = await service.list({ active: false });
    expect(list.map((p) => p.fullName)).toEqual(['Carla Dias']);
  });

  it('searches by name (case-insensitive substring)', async () => {
    const list = await service.list({ search: 'bru' });
    expect(list.map((p) => p.fullName)).toEqual(['Bruno Lima']);
  });

  it('combines active filter and search', async () => {
    const list = await service.list({ active: true, search: 'ana' });
    expect(list.map((p) => p.fullName)).toEqual(['Ana Souza']);
  });
});

describe('PatientService.update', () => {
  it('updates the provided fields and leaves others untouched', async () => {
    const created = await service.create(baseInput);
    const updated = await service.update(created.id, { fullName: 'Raiany S.' });
    expect(updated.fullName).toBe('Raiany S.');
    expect(updated.address).toBe(baseInput.address);
  });

  it('throws NotFound when patient is missing', async () => {
    await expect(
      service.update('00000000-0000-0000-0000-000000000000', { fullName: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('PatientService.deactivate', () => {
  it('sets active=false', async () => {
    const created = await service.create(baseInput);
    const deactivated = await service.deactivate(created.id);
    expect(deactivated.active).toBe(false);
  });

  it('throws NotFound when the patient does not exist', async () => {
    await expect(
      service.deactivate('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
