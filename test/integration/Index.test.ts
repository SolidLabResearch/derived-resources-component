import { QueryEngine } from '@comunica/query-sparql';
import type { App } from '@solid/community-server';
import { AppRunner, joinFilePath, joinUrl, LDP, RDF } from '@solid/community-server';
import { DataFactory, Parser, Store } from 'n3';
import { DERIVED_INDEX } from '../../src/Vocabularies';
import namedNode = DataFactory.namedNode;

async function responseToStore(res: Response, baseIRI: string): Promise<Store> {
  return new Store(new Parser({ baseIRI }).parse(await res.text()));
}

const port = 3457;
const baseUrl = `http://localhost:${port}/`;

// Test is here to make sure we didn't accidentally break something in the flow
describe('The server auth test setup', (): void => {
  let app: App;

  beforeAll(async(): Promise<void> => {
    app = await new AppRunner().create(
      {
        config: [
          joinFilePath(__dirname, '../../config/example.json'),
          joinFilePath(__dirname, '../../config/derived-auth.json'),
          joinFilePath(__dirname, '../../config/main.json'),
        ],
        loaderProperties: {
          mainModulePath: joinFilePath(__dirname, '../../'),
          dumpErrorState: false,
        },
        shorthand: {
          port,
          loggingLevel: 'off',
        },
      },
    );

    await app.start();
  });

  afterAll(async(): Promise<void> => {
    await app.stop();
  });

  it('returns the derived index resource.', async(): Promise<void> => {
    const res = await fetch(joinUrl(baseUrl, 'index/type'));
    const store = await responseToStore(res, joinUrl(baseUrl, 'index/type'));
    const subjects = store.getSubjects(DERIVED_INDEX.terms.for, namedNode('http://xmlns.com/foaf/0.1/Agent'), null);
    expect(subjects).toHaveLength(1);
    expect(store.countQuads(subjects[0], DERIVED_INDEX.terms.instance, null, null)).toBe(1);
    expect(store.countQuads(
      subjects[0],
      DERIVED_INDEX.terms.instance,
      namedNode(joinUrl(baseUrl, 'data/auth/public')),
      null,
    )).toBe(1);
  });

  it('returns more resources when authorized.', async(): Promise<void> => {
    const res = await fetch(joinUrl(baseUrl, 'index/type'), { headers: { Authorization: 'WebID http://example.com/alice' }});
    const store = await responseToStore(res, joinUrl(baseUrl, 'index/type'));
    const subjects = store.getSubjects(DERIVED_INDEX.terms.for, namedNode('http://xmlns.com/foaf/0.1/Agent'), null);
    expect(subjects).toHaveLength(1);
    expect(store.countQuads(subjects[0], DERIVED_INDEX.terms.instance, null, null)).toBe(2);
    expect(store.countQuads(
      subjects[0],
      DERIVED_INDEX.terms.instance,
      namedNode(joinUrl(baseUrl, 'data/auth/public')),
      null,
    )).toBe(1);
    expect(store.countQuads(
      subjects[0],
      DERIVED_INDEX.terms.instance,
      namedNode(joinUrl(baseUrl, 'data/auth/alice')),
      null,
    )).toBe(1);
  });

  it('can query the QPF resource using Comunica.', async(): Promise<void> => {
    const query = `
      CONSTRUCT { ?s a ?o }
      WHERE {
        ?s a ?o
      }
    `;
    const engine = new QueryEngine();
    const result = await engine.queryQuads(query, { sources: [ joinUrl(baseUrl, 'index/qpf') ]});
    const store = new Store();
    for await (const quad of result) {
      store.add(quad);
    }
    expect(store.size).toBe(5);
    expect(store.countQuads('http://localhost:3457/data/auth/', RDF.terms.type, LDP.terms.Resource, null)).toBe(1);
    expect(store.countQuads('http://localhost:3457/data/auth/', RDF.terms.type, LDP.terms.Container, null)).toBe(1);
    expect(store.countQuads('http://localhost:3457/data/auth/', RDF.terms.type, LDP.terms.BasicContainer, null)).toBe(1);
    expect(store.countQuads('http://localhost:3457/data/auth/public', RDF.terms.type, 'http://xmlns.com/foaf/0.1/Project', null)).toBe(1);
    expect(store.countQuads('http://localhost:3457/data/auth/public', RDF.terms.type, 'http://xmlns.com/foaf/0.1/Agent', null)).toBe(1);
  });
});
