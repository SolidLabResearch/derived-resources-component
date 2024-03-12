import { BasicRepresentation, readableToQuads, ResourceStore } from '@solid/community-server';
import { DataFactory, Parser, Store } from 'n3';
import { FilterHandlerInput } from '../../src/FilterHandler';
import { SparqlFilterHandler } from '../../src/SparqlFilterHandler';
import namedNode = DataFactory.namedNode;
import literal = DataFactory.literal;

describe('SparqlFilterHandler', (): void => {
  const query = `
    PREFIX foaf: <http://xmlns.com/foaf/0.1/>
    CONSTRUCT { ?s foaf:name ?o }
    WHERE {
      ?s foaf:$var$ ?o.
    }`;
  const dataString = `
    @prefix foaf: <http://xmlns.com/foaf/0.1/>.
    <> foaf:knows <http://example.com/alice>.
    <> foaf:name "Example".`;
  const data = new Store(new Parser({ baseIRI: 'https://example.com/foo' }).parse(dataString));
  const input: FilterHandlerInput = {
    mappings: { var: 'name' },
    data,
    filter: 'https://example.com/filter',
  }

  let store: jest.Mocked<ResourceStore>;
  let handler: SparqlFilterHandler;

  beforeEach(async(): Promise<void> => {
    store = {
      getRepresentation: jest.fn().mockResolvedValue(new BasicRepresentation(query, 'application/sparql')),
    } satisfies Partial<ResourceStore> as any;

    handler = new SparqlFilterHandler(store);
  });

  it('acquires the SPARQL query and executes it on the data.', async(): Promise<void> => {
    let result = await handler.handle(input);
    const quads = await readableToQuads(result);
    expect(quads.countQuads(null, null, null, null)).toBe(1);
    expect(quads.countQuads(namedNode('https://example.com/foo'), namedNode('http://xmlns.com/foaf/0.1/name'), literal('Example'), null))
      .toBe(1);
  });
});
