import { describe, expect, it } from 'vitest';
import { LocalFileStorage } from '../../../src/shared/storage/LocalFileStorage.js';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('LocalFileStorage', () => {
  it('writes the content to disk and returns the public URL', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fs-'));
    try {
      const storage = new LocalFileStorage(dir, '/uploads');
      const url = await storage.save('signature.png', Buffer.from('PNGDATA'));
      expect(url).toBe('/uploads/signature.png');
      const written = await readFile(join(dir, 'signature.png'));
      expect(written.toString()).toBe('PNGDATA');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('creates the root directory if it does not exist yet', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'fs-'));
    const root = join(parent, 'nested', 'uploads');
    try {
      const storage = new LocalFileStorage(root, '/u');
      const url = await storage.save('a.bin', Buffer.from('x'));
      expect(url).toBe('/u/a.bin');
      expect((await readFile(join(root, 'a.bin'))).toString()).toBe('x');
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });
});
