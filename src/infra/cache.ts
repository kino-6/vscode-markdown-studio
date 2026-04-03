import crypto from 'node:crypto';

export class ContentCache<T> {
  private readonly entries = new Map<string, T>();

  public createKey(parts: string[]): string {
    const digest = crypto.createHash('sha256');
    for (const part of parts) {
      digest.update(part);
      digest.update('\n--\n');
    }
    return digest.digest('hex');
  }

  public get(key: string): T | undefined {
    return this.entries.get(key);
  }

  public set(key: string, value: T): void {
    this.entries.set(key, value);
  }
}
