import { Quad } from '@rdfjs/types';
import { BasicRepresentation, DC, guardedStreamFrom, readableToQuads, Representation } from '@solid/community-server';
import { DataFactory } from 'n3';
import { CachedQuadFilterParser } from '../../../../src/filter/idx/CachedQuadFilterParser';
import { QuadFilterParser } from '../../../../src/filter/idx/QuadFilterParser';

async function flushPromises(): Promise<void> {
  // This flushes the promises, causing the cache to be filled
  await new Promise(jest.requireActual('timers').setImmediate);
}

describe('A CachedQuadFilterParser', (): void => {
  let filter: Partial<Quad> = {
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
  let source: jest.Mocked<QuadFilterParser>;
  let parser: CachedQuadFilterParser;

  beforeEach(async(): Promise<void> => {
    representation = new BasicRepresentation();
    representation.metadata.set(DC.terms.modified, new Date(1988, 2, 9).toISOString());

    source = {
      canHandle: jest.fn(),
      handle: jest.fn(async() => guardedStreamFrom(quads)),
    } satisfies Partial<QuadFilterParser> as any;

    parser = new CachedQuadFilterParser(source);
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
    let filter2: Partial<Quad> = { predicate: DataFactory.variable('v') };
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
