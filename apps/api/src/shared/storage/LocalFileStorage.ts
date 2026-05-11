import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileStorage } from './FileStorage.js';

export class LocalFileStorage implements FileStorage {
  constructor(
    private readonly root: string,
    private readonly publicPrefix: string,
  ) {}

  async save(filename: string, content: Buffer): Promise<string> {
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, filename), content);
    return `${this.publicPrefix}/${filename}`;
  }
}
