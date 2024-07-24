import type { KeyValueStorage } from '@solid/community-server';
import { NotImplementedHttpError } from '@solid/community-server';

/**
 * A {@link KeyValueStorage} that uses a {@link WeakMap} to store the values.
 * Because of this, the key value is expected to be an object and not a primitive value.
 */
export class WeakStorage<TKey extends Record<string, unknown>, TValue> implements KeyValueStorage<TKey, TValue> {
  protected readonly cache: WeakMap<TKey, TValue>;

  public constructor() {
    this.cache = new WeakMap();
  }

  public async get(key: TKey): Promise<TValue | undefined> {
    return this.cache.get(key);
  }

  public async has(key: TKey): Promise<boolean> {
    return this.cache.has(key);
  }

  public async set(key: TKey, value: TValue): Promise<this> {
    this.cache.set(key, value);
    return this;
  }

  public async delete(key: TKey): Promise<boolean> {
    return this.cache.delete(key);
  }

  public entries(): never {
    throw new NotImplementedHttpError('Entries call is not supported for WeakStorage.');
  }
}
