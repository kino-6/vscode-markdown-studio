import crypto from 'node:crypto';

const DEFAULT_MAX_ENTRIES = 128;

export class ContentCache<T> {
  private readonly entries = new Map<string, T>();
  private readonly maxEntries: number;

  constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  public createKey(parts: string[]): string {
    const digest = crypto.createHash('sha256');
    for (const part of parts) {
      digest.update(part);
      digest.update('\n--\n');
    }
    return digest.digest('hex');
  }

  public get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    // Move to end (most-recently-used)
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  public set(key: string, value: T): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.entries.delete(oldest);
      }
    }
    this.entries.set(key, value);
  }

  public clear(): void {
    this.entries.clear();
  }

  public get size(): number {
    return this.entries.size;
  }
}
