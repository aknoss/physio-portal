import type { PasswordHasher } from '../../shared/crypto/PasswordHasher.js';
import type { FileStorage } from '../../shared/storage/FileStorage.js';
import type { TokenSigner } from '../../shared/tokens/TokenSigner.js';
import { NotFoundError, UnauthorizedError } from '../../shared/http/HttpError.js';
import type { User } from './User.js';
import type { UpdateProfileInput, UserRepository } from './UserRepository.js';

export type LoginResult = {
  token: string;
  user: User;
};

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly signer: TokenSigner,
    private readonly storage: FileStorage,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedError('Invalid credentials');
    const ok = await this.hasher.verify(password, user.passwordHash);
    if (!ok) throw new UnauthorizedError('Invalid credentials');
    return { token: this.signer.sign({ userId: user.id }), user };
  }

  async getMe(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
    const updated = await this.users.updateProfile(userId, input);
    if (!updated) throw new NotFoundError('User not found');
    return updated;
  }

  async setSignature(userId: string, content: Buffer): Promise<User> {
    const filename = `signature-${userId}.png`;
    const url = await this.storage.save(filename, content);
    const updated = await this.users.updateSignatureUrl(userId, url);
    if (!updated) throw new NotFoundError('User not found');
    return updated;
  }
}
