import type { Readable } from 'node:stream';
import type { Quad } from '@rdfjs/types';
import type { Guarded } from '@solid/community-server';
import {
  BasicRepresentation,
  guardedStreamFrom,
  INTERNAL_QUADS,
  NotImplementedHttpError,
  readableToQuads,
  RepresentationMetadata,
} from '@solid/community-server';
import { DataFactory } from 'n3';
import type { FilterExecutorInput } from '../../../../src/filter/FilterExecutor';
import { IndexFilterExecutor } from '../../../../src/filter/idx/IndexFilterExecutor';
import type { QuadPatternExecutor } from '../../../../src/filter/idx/QuadPatternExecutor';
import { DERIVED_INDEX, DERIVED_TYPES } from '../../../../src/Vocabularies';

describe('IndexFilterExecutor', (): void => {
  const subject = DataFactory.namedNode('subject');
  const typeNode = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
  const type1 = DataFactory.namedNode('http://xmlns.com/foaf/0.1/Agent');
  const type2 = DataFactory.namedNode('http://xmlns.com/foaf/0.1/Person');
  const id1 = DataFactory.namedNode('http://example.com/res1');
  const id2 = DataFactory.namedNode('http://example.com/res2');
  const filter = {
    predicate: {
      termType: 'NamedNode',
      value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    },
    object: {
      termType: 'Variable',
      value: 'v',
    },
  } as Partial<Quad>;
  let resourceIndexParser: jest.Mocked<QuadPatternExecutor>;
  let input: FilterExecutorInput<Partial<Quad>>;
  let executor: IndexFilterExecutor;

  beforeEach(async(): Promise<void> => {
    const quads1 = [
      DataFactory.quad(subject, typeNode, type1),
      DataFactory.quad(subject, typeNode, type2),
    ];
    const quads2 = [
      DataFactory.quad(subject, typeNode, type1),
    ];

    input = {
      config: {
        identifier: { path: 'http://example.com/foo' },
        mappings: {},
        selectors: [],
        filter: 'filter',
        metadata: new RepresentationMetadata(),
      },
      filter: {
        data: filter,
        type: DERIVED_TYPES.terms.QuadPattern,
        metadata: new RepresentationMetadata(),
      },
      representations: [
        new BasicRepresentation([], id1),
        new BasicRepresentation([], id2),
      ],
    };

    resourceIndexParser = {
      canHandle: jest.fn(),
      handle: jest.fn(async({ representation }): Promise<Guarded<Readable>> => {
        if (representation.metadata.identifier.equals(id1)) {
          return guardedStreamFrom(quads1);
        }
        return guardedStreamFrom(quads2);
      }),
    } satisfies Partial<QuadPatternExecutor> as any;

    executor = new IndexFilterExecutor(resourceIndexParser);
  });

  it('rejects non-quad filters.', async(): Promise<void> => {
    input.filter.type = DERIVED_TYPES.terms.String;
    await expect(executor.canHandle(input)).rejects.toThrow(NotImplementedHttpError);
  });

  it('rejects quads that do not have exactly 1 variable.', async(): Promise<void> => {
    input.filter.data = {
      predicate: {
        termType: 'Variable',
        value: 'v1',
      },
      object: {
        termType: 'Variable',
        value: 'v2',
      },
    } as Partial<Quad>;
    await expect(executor.canHandle(input)).rejects.toThrow(NotImplementedHttpError);
  });

  it('requires the ResourceIndexParser to accept all representations.', async(): Promise<void> => {
    await expect(executor.canHandle(input)).resolves.toBeUndefined();
    expect(resourceIndexParser.canHandle).toHaveBeenCalledTimes(2);
    expect(resourceIndexParser.canHandle)
      .toHaveBeenNthCalledWith(1, { filter, representation: input.representations[0] });
    expect(resourceIndexParser.canHandle)
      .toHaveBeenNthCalledWith(2, { filter, representation: input.representations[1] });
  });

  it('generates the correct triples based on the input streams.', async(): Promise<void> => {
    const result = await executor.handle(input);
    expect(result.metadata.identifier.value).toBe(input.config.identifier.path);
    expect(result.metadata.contentType).toBe(INTERNAL_QUADS);
    const store = await readableToQuads(result.data);

    const sub1 = store.getSubjects(DERIVED_INDEX.terms.for, type1, null);
    const sub2 = store.getSubjects(DERIVED_INDEX.terms.for, type2, null);
    expect(sub1).toHaveLength(1);
    expect(sub2).toHaveLength(1);
    expect(store.has(DataFactory.quad(sub1[0], DERIVED_INDEX.terms.instance, id1))).toBe(true);
    expect(store.has(DataFactory.quad(sub1[0], DERIVED_INDEX.terms.instance, id2))).toBe(true);
    expect(store.has(DataFactory.quad(sub2[0], DERIVED_INDEX.terms.instance, id1))).toBe(true);
    expect(store.has(DataFactory.quad(sub2[0], DERIVED_INDEX.terms.instance, id2))).toBe(false);
    expect(store.has(DataFactory.quad(sub1[0], DERIVED_INDEX.terms.instance, id1))).toBe(true);
  });
});
