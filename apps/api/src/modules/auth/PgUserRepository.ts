import type { Pool } from 'pg';
import type { User } from './User.js';
import type {
  CreateUserInput,
  UpdateProfileInput,
  UserRepository,
} from './UserRepository.js';

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  cref: string;
  signature_url: string | null;
  created_at: Date;
};

function mapRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    cref: row.cref,
    signatureUrl: row.signature_url,
    createdAt: row.created_at,
  };
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateUserInput): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, full_name, cref)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.email, input.passwordHash, input.fullName, input.cref],
    );
    return mapRow(result.rows[0]!);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(`SELECT * FROM users WHERE email = $1`, [email]);
    return result.rowCount === 0 ? null : mapRow(result.rows[0]!);
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(`SELECT * FROM users WHERE id = $1`, [id]);
    return result.rowCount === 0 ? null : mapRow(result.rows[0]!);
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `UPDATE users SET full_name = $2, cref = $3 WHERE id = $1 RETURNING *`,
      [id, input.fullName, input.cref],
    );
    return result.rowCount === 0 ? null : mapRow(result.rows[0]!);
  }

  async updateSignatureUrl(id: string, url: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `UPDATE users SET signature_url = $2 WHERE id = $1 RETURNING *`,
      [id, url],
    );
    return result.rowCount === 0 ? null : mapRow(result.rows[0]!);
  }
}
