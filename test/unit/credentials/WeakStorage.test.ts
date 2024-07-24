import { NotImplementedHttpError } from '@solid/community-server';
import { WeakStorage } from '../../../src/credentials/WeakStorage';

describe('WeakStorage', (): void => {
  it('works as a storage.', async(): Promise<void> => {
    const storage = new WeakStorage<Record<string, string>, string>();
    const key = { test: 'key' };
    const value = 'value';
    await expect(storage.has(key)).resolves.toBe(false);
    await expect(storage.get(key)).resolves.toBeUndefined();
    await expect(storage.set(key, value)).resolves.toBe(storage);
    await expect(storage.has(key)).resolves.toBe(true);
    await expect(storage.get(key)).resolves.toBe(value);
    await expect(storage.delete(key)).resolves.toBe(true);
    await expect(storage.has(key)).resolves.toBe(false);
    await expect(storage.get(key)).resolves.toBeUndefined();
    await expect(storage.delete(key)).resolves.toBe(false);
  });

  it('errors when calling entries.', async(): Promise<void> => {
    const storage = new WeakStorage();
    expect((): void => storage.entries()).toThrow(NotImplementedHttpError);
  });
});
