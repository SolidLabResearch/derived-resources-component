import type {
  Representation,
} from '@solid/community-server';
import {
  BasicRepresentation,
  DC,
  readableToString,
  RepresentationMetadata,
} from '@solid/community-server';
import { CachedFilterExecutor } from '../../../src/filter/CachedFilterExecutor';
import type { FilterExecutor, FilterExecutorInput } from '../../../src/filter/FilterExecutor';
import { DERIVED_TYPES } from '../../../src/Vocabularies';

async function flushPromises(): Promise<void> {
  // This flushes the promises, causing the cache to be filled
  await new Promise(jest.requireActual('timers').setImmediate);
}

describe('A CachedFilterExecutor', (): void => {
  const date = new Date();
  let input: FilterExecutorInput;
  let source: jest.Mocked<FilterExecutor>;
  let executor: CachedFilterExecutor;

  beforeEach(async(): Promise<void> => {
    input = {
      filter: {
        data: 'filter data',
        checksum: 'checksum',
        type: DERIVED_TYPES.terms.String,
        metadata: new RepresentationMetadata(),
      },
      config: {
        identifier: { path: 'https://example.com' },
        mappings: { var: 'value', other: 'unused' },
        selectors: [ 'selector' ],
        filter: 'filter id',
        metadata: new RepresentationMetadata(),
      },
      representations: [
        new BasicRepresentation('', new RepresentationMetadata({ [DC.modified]: date.toISOString() })),
        new BasicRepresentation('', new RepresentationMetadata({ [DC.modified]: date.toISOString() })),
      ],
    };

    source = {
      canHandle: jest.fn(),
      handle: jest.fn(async(): Promise<Representation> => new BasicRepresentation('test', 'text/plain')),
    } satisfies Partial<FilterExecutor> as any;

    executor = new CachedFilterExecutor(source);
  });

  it('can handle anything its source can handle.', async(): Promise<void> => {
    await expect(executor.canHandle(input)).resolves.toBeUndefined();
    expect(source.canHandle).toHaveBeenLastCalledWith(input);

    const error = new Error('bad data');
    source.canHandle.mockRejectedValue(error);
    await expect(executor.canHandle(input)).rejects.toThrow(error);
  });

  it('returns the result of the source.', async(): Promise<void> => {
    const result = await executor.handle(input);
    await expect(readableToString(result.data)).resolves.toBe('test');
    expect(result.metadata.contentType).toBe('text/plain');
    expect(source.handle).toHaveBeenLastCalledWith(input);
  });

  it('caches the result.', async(): Promise<void> => {
    await executor.handle(input);
    expect(source.handle).toHaveBeenCalledTimes(1);

    await flushPromises();

    const result = await executor.handle(input);
    await expect(readableToString(result.data)).resolves.toBe('test');
    expect(result.metadata.contentType).toBe('text/plain');
    expect(source.handle).toHaveBeenCalledTimes(1);
  });

  it('does not use the cached result if an input changed.', async(): Promise<void> => {
    await executor.handle(input);
    expect(source.handle).toHaveBeenCalledTimes(1);

    await flushPromises();

    input.representations[0].metadata.set(DC.terms.modified, new Date().toISOString());

    const result = await executor.handle(input);
    await expect(readableToString(result.data)).resolves.toBe('test');
    expect(result.metadata.contentType).toBe('text/plain');
    expect(source.handle).toHaveBeenCalledTimes(2);
  });

  it('does not use the cached result if there is no checksum.', async(): Promise<void> => {
    delete input.filter.checksum;
    await executor.handle(input);
    expect(source.handle).toHaveBeenCalledTimes(1);

    await flushPromises();

    const result = await executor.handle(input);
    await expect(readableToString(result.data)).resolves.toBe('test');
    expect(result.metadata.contentType).toBe('text/plain');
    expect(source.handle).toHaveBeenCalledTimes(2);
  });
});
