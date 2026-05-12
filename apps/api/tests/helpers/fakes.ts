import { randomUUID } from 'node:crypto';
import type { Clock } from '../../src/shared/clock/Clock.js';
import type { PasswordHasher } from '../../src/shared/crypto/PasswordHasher.js';
import type { FileStorage } from '../../src/shared/storage/FileStorage.js';
import type { TokenPayload, TokenSigner } from '../../src/shared/tokens/TokenSigner.js';
import type { User } from '../../src/modules/auth/User.js';
import type {
  CreateUserInput,
  UpdateProfileInput,
  UserRepository,
} from '../../src/modules/auth/UserRepository.js';
import type { Patient } from '../../src/modules/patients/Patient.js';
import type {
  CreatePatientInput,
  ListPatientsFilter,
  PatientRepository,
  UpdatePatientInput,
} from '../../src/modules/patients/PatientRepository.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly rows: User[] = [];

  async create(input: CreateUserInput): Promise<User> {
    const user: User = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      cref: input.cref,
      signatureUrl: null,
      createdAt: new Date(),
    };
    this.rows.push(user);
    return { ...user };
  }

  async findByEmail(email: string): Promise<User | null> {
    const found = this.rows.find((u) => u.email === email);
    return found ? { ...found } : null;
  }

  async findById(id: string): Promise<User | null> {
    const found = this.rows.find((u) => u.id === id);
    return found ? { ...found } : null;
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<User | null> {
    const row = this.rows.find((u) => u.id === id);
    if (!row) return null;
    row.fullName = input.fullName;
    row.cref = input.cref;
    return { ...row };
  }

  async updateSignatureUrl(id: string, url: string): Promise<User | null> {
    const row = this.rows.find((u) => u.id === id);
    if (!row) return null;
    row.signatureUrl = url;
    return { ...row };
  }
}

export class InMemoryPatientRepository implements PatientRepository {
  private readonly rows: Patient[] = [];

  async create(input: CreatePatientInput): Promise<Patient> {
    const patient: Patient = {
      id: randomUUID(),
      fullName: input.fullName,
      address: input.address,
      phone: input.phone,
      sessionPriceCents: input.sessionPriceCents,
      notes: input.notes,
      active: true,
      createdAt: new Date(),
    };
    this.rows.push(patient);
    return { ...patient };
  }

  async findById(id: string): Promise<Patient | null> {
    const found = this.rows.find((p) => p.id === id);
    return found ? { ...found } : null;
  }

  async list(filter: ListPatientsFilter): Promise<Patient[]> {
    let result = [...this.rows];
    if (filter.active !== undefined) {
      result = result.filter((p) => p.active === filter.active);
    }
    if (filter.search !== undefined) {
      const needle = filter.search.toLowerCase();
      result = result.filter((p) => p.fullName.toLowerCase().includes(needle));
    }
    return result
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((p) => ({ ...p }));
  }

  async update(id: string, input: UpdatePatientInput): Promise<Patient | null> {
    const row = this.rows.find((p) => p.id === id);
    if (!row) return null;
    if (input.fullName !== undefined) row.fullName = input.fullName;
    if (input.address !== undefined) row.address = input.address;
    if (input.phone !== undefined) row.phone = input.phone;
    if (input.sessionPriceCents !== undefined) row.sessionPriceCents = input.sessionPriceCents;
    if (input.notes !== undefined) row.notes = input.notes;
    if (input.active !== undefined) row.active = input.active;
    return { ...row };
  }

  async deactivate(id: string): Promise<Patient | null> {
    const row = this.rows.find((p) => p.id === id);
    if (!row) return null;
    row.active = false;
    return { ...row };
  }
}

import type { Schedule } from '../../src/modules/schedule/Schedule.js';
import type {
  ScheduleRepository,
  UpsertScheduleInput,
} from '../../src/modules/schedule/ScheduleRepository.js';

export class InMemoryScheduleRepository implements ScheduleRepository {
  private readonly rows = new Map<string, Schedule>();

  async upsert(input: UpsertScheduleInput): Promise<Schedule> {
    const schedule: Schedule = {
      patientId: input.patientId,
      weekdays: [...input.weekdays],
      startDate: input.startDate,
      endDate: input.endDate,
    };
    this.rows.set(input.patientId, schedule);
    return { ...schedule, weekdays: [...schedule.weekdays] };
  }

  async findByPatientId(patientId: string): Promise<Schedule | null> {
    const found = this.rows.get(patientId);
    return found ? { ...found, weekdays: [...found.weekdays] } : null;
  }
}

import type { Session } from '../../src/modules/sessions/Session.js';
import type {
  CreateSessionInput,
  SessionRepository,
} from '../../src/modules/sessions/SessionRepository.js';

export class InMemorySessionRepository implements SessionRepository {
  private readonly rows: Session[] = [];

  async bulkCreateScheduled(inputs: CreateSessionInput[]): Promise<Session[]> {
    const created: Session[] = [];
    for (const input of inputs) {
      if (this.rows.some((r) => r.patientId === input.patientId && r.date === input.date)) {
        continue;
      }
      const session: Session = {
        id: randomUUID(),
        patientId: input.patientId,
        date: input.date,
        status: 'SCHEDULED',
        priceCents: input.priceCents,
        note: null,
      };
      this.rows.push(session);
      created.push({ ...session });
    }
    return created;
  }

  async listByPatientInRange(
    patientId: string,
    from: string,
    to: string,
  ): Promise<Session[]> {
    return this.rows
      .filter((r) => r.patientId === patientId && r.date >= from && r.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ ...r }));
  }

  snapshot(): Session[] {
    return this.rows.map((r) => ({ ...r }));
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }

  async verify(plain: string, hashed: string): Promise<boolean> {
    return hashed === `hashed:${plain}`;
  }
}

export class FakeTokenSigner implements TokenSigner {
  sign(payload: TokenPayload): string {
    return `token:${payload.userId}`;
  }

  verify(token: string): TokenPayload {
    if (!token.startsWith('token:')) throw new Error('invalid token');
    return { userId: token.slice('token:'.length) };
  }
}

export class FakeFileStorage implements FileStorage {
  readonly saved: { filename: string; content: Buffer }[] = [];

  async save(filename: string, content: Buffer): Promise<string> {
    this.saved.push({ filename, content });
    return `/uploads/${filename}`;
  }
}

export class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}

  now(): Date {
    return new Date(this.fixed);
  }
}
