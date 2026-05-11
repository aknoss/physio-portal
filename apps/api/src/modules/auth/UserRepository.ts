import type { User } from './User.js';

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  fullName: string;
  cref: string;
};

export type UpdateProfileInput = {
  fullName: string;
  cref: string;
};

export interface UserRepository {
  create(input: CreateUserInput): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  updateProfile(id: string, input: UpdateProfileInput): Promise<User | null>;
  updateSignatureUrl(id: string, url: string): Promise<User | null>;
}
