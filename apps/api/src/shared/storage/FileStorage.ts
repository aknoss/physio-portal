export interface FileStorage {
  save(filename: string, content: Buffer): Promise<string>;
}
