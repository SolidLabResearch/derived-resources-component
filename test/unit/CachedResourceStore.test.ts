import {
  BasicRepresentation,
  readableToString,
  Representation,
  RepresentationMetadata,
  ResourceStore
} from '@solid/community-server';
import { AuxiliaryIdentifierStrategy } from '@solid/community-server/dist/http/auxiliary/AuxiliaryIdentifierStrategy';
import { IdentifierMap } from '@solid/community-server/dist/util/map/IdentifierMap';
import { CachedResourceStore } from '../../src/CachedResourceStore';

async function flushPromises(): Promise<void> {
  // This flushes the promises, causing the cache to be filled
  await new Promise(jest.requireActual('timers').setImmediate);
}

describe('A CachedResourceStore', (): void => {
  const identifier = { path: 'https://example.com/foo' };
  const metaIdentifier = { path: 'https://example.com/foo.meta' };
  let representation: Representation;
  let source: jest.Mocked<ResourceStore>;
  let metadataStrategy: jest.Mocked<AuxiliaryIdentifierStrategy>;
  let store: CachedResourceStore;

  beforeEach(async(): Promise<void> => {
    representation = new BasicRepresentation('pear', identifier, 'text/turtle');
    source = {
      hasResource: jest.fn().mockResolvedValue(true),
      getRepresentation: jest.fn(async(...args) =>
        new BasicRepresentation('pear', identifier, 'text/turtle')),
      addResource: jest.fn(async(id, rep) => new IdentifierMap([[ id, new RepresentationMetadata() ]])),
      setRepresentation: jest.fn(async(id, rep) => new IdentifierMap([[ id, new RepresentationMetadata() ]])),
      modifyResource: jest.fn(async(id, rep) => new IdentifierMap([[ id, new RepresentationMetadata() ]])),
      deleteResource: jest.fn(async(id) => new IdentifierMap([[ id, new RepresentationMetadata() ]])),
    }

    metadataStrategy = {
      isAuxiliaryIdentifier: jest.fn((id => id.path.endsWith('.meta'))),
      getSubjectIdentifier: jest.fn((id => ({ path: id.path.slice(0, -'.meta'.length) }))),
      getAuxiliaryIdentifier: jest.fn((id => ({ path: id.path + '.meta'}))),
      getAuxiliaryIdentifiers: jest.fn(),
    };

    store = new CachedResourceStore({ source, metadataStrategy });
  });

  it('returns a copy of the source representation if nothing was cached.', async(): Promise<void> => {
    // The returned stream will not be the same object as it is copied during caching
    const result = await store.getRepresentation(identifier, {});
    expect(result.metadata.contentType).toBe('text/turtle');
    await expect(readableToString(result.data)).resolves.toBe('pear');
    expect(source.getRepresentation).toHaveBeenCalledTimes(1);
  });

  it('returns a cached copy on subsequent requests.', async(): Promise<void> => {
    await store.getRepresentation(identifier, {});
    expect(source.getRepresentation).toHaveBeenCalledTimes(1);

    await flushPromises();

    // Even though we change the source response, we still get the original as it comes from the cache
    source.getRepresentation.mockResolvedValue(new BasicRepresentation('apple', identifier, 'text/plain'));
    const result = await store.getRepresentation(identifier, {});
    expect(result.metadata.contentType).toBe('text/turtle');
    await expect(readableToString(result.data)).resolves.toBe('pear');
    expect(source.getRepresentation).toHaveBeenCalledTimes(1);
  });

  it('checks the source for existence if the identifier is not cached.', async(): Promise<void> => {
    await expect(store.hasResource(identifier)).resolves.toBe(true);
    expect(source.hasResource).toHaveBeenCalledTimes(1);
    expect(source.hasResource).toHaveBeenLastCalledWith(identifier);

    source.hasResource.mockResolvedValueOnce(false);
    await expect(store.hasResource(identifier)).resolves.toBe(false);
  });

  it('knows the resource exists if it is in the cache.', async(): Promise<void> => {
    await store.getRepresentation(identifier, {});

    await flushPromises();

    await expect(store.hasResource(identifier)).resolves.toBe(true);
    expect(source.hasResource).toHaveBeenCalledTimes(0);
  });

  it('invalidates the cache when any of the other functions are successful.', async(): Promise<void> => {
    const calls = [
      () => store.addResource(identifier, representation),
      () => store.setRepresentation(identifier, representation),
      () => store.modifyResource(identifier, representation),
      () => store.deleteResource(identifier),
    ];
    for (const call of calls) {
      source.getRepresentation.mockClear();

      // Reset cache
      store = new CachedResourceStore({ source, metadataStrategy });

      // Put in cache
      await store.getRepresentation(identifier, {});
      expect(source.getRepresentation).toHaveBeenCalledTimes(1);

      const changeMap = await call();
      expect([ ...changeMap.keys() ]).toEqual([ identifier ]);

      // Should not be in cache due to call above
      await store.getRepresentation(identifier, {});
      expect(source.getRepresentation).toHaveBeenCalledTimes(2);
    }
  });

  it('invalidates metadata identifiers when changing a resource.', async(): Promise<void> => {
    await store.getRepresentation(metaIdentifier, {});
    await flushPromises();
    await store.getRepresentation(metaIdentifier, {});
    expect(source.getRepresentation).toHaveBeenCalledTimes(1);

    await store.setRepresentation(identifier, representation);
    await flushPromises();
    await store.getRepresentation(metaIdentifier, {});
    expect(source.getRepresentation).toHaveBeenCalledTimes(2);
  });

  it('invalidates identifiers when changing their metadata.', async(): Promise<void> => {
    await store.getRepresentation(identifier, {});
    await flushPromises();
    await store.getRepresentation(identifier, {});
    expect(source.getRepresentation).toHaveBeenCalledTimes(1);

    await store.setRepresentation(metaIdentifier, representation);
    await flushPromises();
    await store.getRepresentation(identifier, {});
    expect(source.getRepresentation).toHaveBeenCalledTimes(2);
  });

  it('can invalidate a caching that is not finished yet.', async(): Promise<void> => {
    await store.getRepresentation(identifier, {});
    await store.setRepresentation(identifier, representation);
    await flushPromises();
    await store.getRepresentation(identifier, {});
    expect(source.getRepresentation).toHaveBeenCalledTimes(2);
  });
});
