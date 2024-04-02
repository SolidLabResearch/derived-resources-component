import {
  asyncToArray,
  BasicRepresentation,
  CONTENT_TYPE,
  INTERNAL_QUADS,
  NotImplementedHttpError,
  RepresentationMetadata
} from '@solid/community-server';
import { DataFactory, Store } from 'n3';
import { FilterExecutorInput } from '../../../src/filter/FilterExecutor';
import { IndexFilterExecutor } from '../../../src/filter/IndexFilterExecutor';
import { DERIVED_INDEX } from '../../../src/Vocabularies';

describe('IndexFilterExecutor', (): void => {
  const subject = DataFactory.namedNode('subject');
  const typeNode = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
  const otherNode = DataFactory.namedNode('http://xmlns.com/foaf/0.1/topic');
  const type1 = DataFactory.namedNode('http://xmlns.com/foaf/0.1/Agent');
  const type2 = DataFactory.namedNode('http://xmlns.com/foaf/0.1/Person');
  const id1 = DataFactory.namedNode('http://example.com/res1');
  const id2 = DataFactory.namedNode('http://example.com/res2');
  let input: FilterExecutorInput;
  let executor: IndexFilterExecutor;

  beforeEach(async(): Promise<void> => {
    const quads1 = [
      DataFactory.quad(subject, typeNode, type1),
      DataFactory.quad(subject, typeNode, type2),
      DataFactory.quad(subject, otherNode, type1),
    ];
    const quads2 = [
      DataFactory.quad(subject, typeNode, type1),
      DataFactory.quad(subject, otherNode, type1),
    ];

    const metadata1 = new RepresentationMetadata(id1, { [CONTENT_TYPE]: INTERNAL_QUADS });
    const metadata2 = new RepresentationMetadata(id2, { [CONTENT_TYPE]: INTERNAL_QUADS });

    input = {
      config: {
        identifier: { path: 'http://example.com/foo' },
        mappings: {},
        selectors: [],
        filter: 'filter',
        metadata: new RepresentationMetadata(),
      },
      filter: {
        data: `{
                "predicate": {
                  "termType": "NamedNode",
                  "value": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type"
                },
                "object": {
                  "termType": "Variable",
                  "value": "v"
                }
              }`,
        metadata: new RepresentationMetadata({ [CONTENT_TYPE]: 'application/json' }),
      },
      representations: [
        new BasicRepresentation(quads1, metadata1),
        new BasicRepresentation(quads2, metadata2),
      ],
    }

    executor = new IndexFilterExecutor();
  });

  it('requires JSON.', async(): Promise<void> => {
    input.filter.metadata.contentType = 'text/plain';
    await expect(executor.canHandle(input)).rejects.toThrow(NotImplementedHttpError);
  });

  it('requires the filter to be a string.', async(): Promise<void> => {
    input.filter.data = 5;
    await expect(executor.canHandle(input)).rejects.toThrow(NotImplementedHttpError);
  });

  it('rejects non-quad filters.', async(): Promise<void> => {
    input.filter.data = '{ "wrong": "field" }';
    await expect(executor.canHandle(input)).rejects.toThrow(NotImplementedHttpError);
  });

  it('rejects quads that do not have exactly 1 variable.', async(): Promise<void> => {
    input.filter.data = `{
                "predicate": {
                  "termType": "Variable",
                  "value": "v1"
                },
                "object": {
                  "termType": "Variable",
                  "value": "v2"
                }
              }`;
    await expect(executor.canHandle(input)).rejects.toThrow(NotImplementedHttpError);
  });

  it('accepts everything else.', async(): Promise<void> => {
    await expect(executor.canHandle(input)).resolves.toBeUndefined();
  });

  it('generates the correct triples based on the input streams.', async(): Promise<void> => {
    const result = await executor.handle(input);
    expect(result.metadata.identifier.value).toBe(input.config.identifier.path);
    expect(result.metadata.contentType).toBe(INTERNAL_QUADS);
    const store = new Store(await asyncToArray(result.data));

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
