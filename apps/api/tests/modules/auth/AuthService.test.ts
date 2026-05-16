import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../../../src/modules/auth/AuthService.js';
import {
  NotFoundError,
  UnauthorizedError,
} from '../../../src/shared/http/HttpError.js';
import {
  FakeFileStorage,
  FakePasswordHasher,
  FakeTokenSigner,
  InMemoryUserRepository,
} from '../../helpers/fakes.js';

let users: InMemoryUserRepository;
let hasher: FakePasswordHasher;
let signer: FakeTokenSigner;
let storage: FakeFileStorage;
let service: AuthService;

beforeEach(async () => {
  users = new InMemoryUserRepository();
  hasher = new FakePasswordHasher();
  signer = new FakeTokenSigner();
  storage = new FakeFileStorage();
  service = new AuthService(users, hasher, signer, storage);
  await users.create({
    email: 'fisio@example.com',
    passwordHash: await hasher.hash('senha123'),
    fullName: 'Raiany',
    cref: 'CREFITO-99999',
  });
});

describe('AuthService.login', () => {
  it('returns a signed token and the user on valid credentials', async () => {
    const result = await service.login('fisio@example.com', 'senha123');
    const user = (await users.findByEmail('fisio@example.com'))!;
    expect(result.user.id).toBe(user.id);
    expect(result.token).toBe(`token:${user.id}`);
  });

  it('throws Unauthorized when the email is unknown', async () => {
    await expect(service.login('nope@example.com', 'senha123')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('throws Unauthorized when the password does not match', async () => {
    await expect(service.login('fisio@example.com', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe('AuthService.getMe', () => {
  it('returns the user for the given id', async () => {
    const u = (await users.findByEmail('fisio@example.com'))!;
    expect((await service.getMe(u.id)).email).toBe('fisio@example.com');
  });

  it('throws NotFound when the user is missing', async () => {
    await expect(service.getMe('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('AuthService.updateProfile', () => {
  it('updates fullName and cref', async () => {
    const u = (await users.findByEmail('fisio@example.com'))!;
    const updated = await service.updateProfile(u.id, {
      fullName: 'Raiany',
      cref: 'CREFITO-99999-RJ',
    });
    expect(updated.fullName).toBe('Raiany');
    expect(updated.cref).toBe('CREFITO-99999-RJ');
  });

  it('throws NotFound when the user does not exist', async () => {
    await expect(
      service.updateProfile('00000000-0000-0000-0000-000000000000', {
        fullName: 'X',
        cref: 'Y',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('AuthService.setSignature', () => {
  it('saves the file via FileStorage and records the URL on the user', async () => {
    const u = (await users.findByEmail('fisio@example.com'))!;
    const content = Buffer.from('PNGDATA');
    const updated = await service.setSignature(u.id, content);

    expect(storage.saved).toHaveLength(1);
    const saved = storage.saved[0]!;
    expect(saved.filename).toBe(`signature-${u.id}.png`);
    expect(saved.content.toString()).toBe('PNGDATA');
    expect(updated.signatureUrl).toBe(`/uploads/signature-${u.id}.png`);
  });

  it('throws NotFound when the user does not exist', async () => {
    await expect(
      service.setSignature('00000000-0000-0000-0000-000000000000', Buffer.from('x')),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
