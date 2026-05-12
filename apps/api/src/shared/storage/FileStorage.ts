export interface FileStorage {
  save(filename: string, content: Buffer): Promise<string>;
  read(filename: string): Promise<Buffer | null>;
}
