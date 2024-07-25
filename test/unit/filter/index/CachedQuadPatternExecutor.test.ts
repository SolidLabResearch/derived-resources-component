import type { Readable } from 'node:stream';
import type { Quad } from '@rdfjs/types';
import type { Guarded, Representation } from '@solid/community-server';
import { BasicRepresentation, DC, guardedStreamFrom, readableToQuads } from '@solid/community-server';
import { DataFactory } from 'n3';
import { CachedQuadPatternExecutor } from '../../../../src/filter/idx/CachedQuadPatternExecutor';
import type { QuadPatternExecutor } from '../../../../src/filter/idx/QuadPatternExecutor';

async function flushPromises(): Promise<void> {
  // This flushes the promises, causing the cache to be filled
  await new Promise(jest.requireActual('timers').setImmediate);
}

describe('A CachedQuadPatternExecutor', (): void => {
  const filter: Partial<Quad> = {
    predicate: DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
    object: DataFactory.variable('v'),
  };
  const subject = DataFactory.namedNode('subject');
  const typeNode = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
  const quads = [
    DataFactory.quad(subject, typeNode, DataFactory.namedNode('http://xmlns.com/foaf/0.1/Agent')),
    DataFactory.quad(subject, typeNode, DataFactory.namedNode('http://xmlns.com/foaf/0.1/Person')),
  ];
  let representation: Representation;
  let source: jest.Mocked<QuadPatternExecutor>;
  let parser: CachedQuadPatternExecutor;

  beforeEach(async(): Promise<void> => {
    representation = new BasicRepresentation();
    representation.metadata.set(DC.terms.modified, new Date(1988, 2, 9).toISOString());

    source = {
      canHandle: jest.fn(),
      handle: jest.fn(async(): Promise<Guarded<Readable>> => guardedStreamFrom(quads)),
    } satisfies Partial<QuadPatternExecutor> as any;

    parser = new CachedQuadPatternExecutor(source);
  });

  it('can handle input its source can handle.', async(): Promise<void> => {
    await expect(parser.canHandle({ filter, representation })).resolves.toBeUndefined();
    expect(source.canHandle).toHaveBeenLastCalledWith({ filter, representation });

    const error = new Error('bad data');
    source.canHandle.mockRejectedValueOnce(error);
    await expect(parser.canHandle({ filter, representation })).rejects.toThrow(error);
  });

  it('caches results after the first call.', async(): Promise<void> => {
    let result = await parser.handle({ filter, representation });
    let store = await readableToQuads(result);
    expect(store.countQuads(null, null, null, null)).toBe(2);
    expect(source.handle).toHaveBeenCalledTimes(1);
    expect(source.handle).toHaveBeenLastCalledWith({ filter, representation });

    result = await parser.handle({ filter, representation });
    store = await readableToQuads(result);
    expect(store.countQuads(null, null, null, null)).toBe(2);
    // Count did not change
    expect(source.handle).toHaveBeenCalledTimes(1);

    representation.metadata.set(DC.terms.modified, new Date().toISOString());
    result = await parser.handle({ filter, representation });
    store = await readableToQuads(result);
    expect(store.countQuads(null, null, null, null)).toBe(2);
    // Count changed
    expect(source.handle).toHaveBeenCalledTimes(2);
  });

  it('has different cache entries per quad filter.', async(): Promise<void> => {
    const filter2: Partial<Quad> = { predicate: DataFactory.variable('v') };
    await parser.handle({ filter, representation });
    await parser.handle({ filter: filter2, representation });
    expect(source.handle).toHaveBeenCalledTimes(2);

    await flushPromises();

    // Both of these should be cached so no extra calls
    await parser.handle({ filter, representation });
    await parser.handle({ filter: filter2, representation });
    expect(source.handle).toHaveBeenCalledTimes(2);

    // Only the resource that is changed should be invalidated, the other one should still be cached
    const representation2 = new BasicRepresentation();
    representation2.metadata.set(DC.terms.modified, new Date().toISOString());
    await parser.handle({ filter, representation });
    await parser.handle({ filter: filter2, representation: representation2 });
    expect(source.handle).toHaveBeenCalledTimes(3);
  });
});
