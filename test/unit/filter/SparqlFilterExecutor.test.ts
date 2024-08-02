import {
  INTERNAL_QUADS,
  NotImplementedHttpError,
  readableToQuads,
  RepresentationMetadata,
} from '@solid/community-server';
import { DataFactory, Store } from 'n3';
import type { N3FilterExecutorInput } from '../../../src/filter/N3FilterExecutor';
import { SparqlFilterExecutor } from '../../../src/filter/SparqlFilterExecutor';
import { DERIVED_TYPES } from '../../../src/Vocabularies';
import literal = DataFactory.literal;
import namedNode = DataFactory.namedNode;

describe('SparqlFilterExecutor', (): void => {
  let input: N3FilterExecutorInput;
  const executor = new SparqlFilterExecutor();

  beforeEach(async(): Promise<void> => {
    input = {
      config: {
        identifier: { path: 'path' },
        mappings: {},
        selectors: [],
        filter: 'filter',
        metadata: new RepresentationMetadata(),
      },
      data: new Store([
        DataFactory.quad(namedNode('http://example.com/foo'), namedNode('http://xmlns.com/foaf/0.1/name'), literal('name')),
        DataFactory.quad(namedNode('http://example.com/foo'), namedNode('http://xmlns.com/foaf/0.1/knows'), literal('other-name')),
      ]),
      filter: {
        data: `
          PREFIX foaf: <http://xmlns.com/foaf/0.1/>
          CONSTRUCT { ?s foaf:name ?o }
          WHERE {
            ?s foaf:name ?o.
          }`,
        type: DERIVED_TYPES.terms.String,
        metadata: new RepresentationMetadata('application/sparql-query'),
      },
    };
  });

  it('can only handle SPARQL query filters.', async(): Promise<void> => {
    await expect(executor.canHandle(input)).resolves.toBeUndefined();

    input.filter.metadata.contentType = 'text/plain';
    await expect(executor.canHandle(input)).rejects.toThrow(NotImplementedHttpError);
  });

  it('executes the SPARQL query.', async(): Promise<void> => {
    const result = await executor.handle(input);
    expect(result.metadata.contentType).toBe(INTERNAL_QUADS);
    const store = await readableToQuads(result.data);
    expect(store.countQuads(null, null, null, null)).toBe(1);
    expect(store.countQuads(namedNode('http://example.com/foo'), namedNode('http://xmlns.com/foaf/0.1/name'), literal('name'), null)).toBe(1);
  });
});
