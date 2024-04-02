import { App, AppRunner, joinFilePath } from '@solid/community-server';
import { DataFactory, Parser, Store } from 'n3';
import literal = DataFactory.literal;
import namedNode = DataFactory.namedNode;

async function responseToStore(res: Response, baseIRI: string): Promise<Store> {
  return new Store(new Parser({ baseIRI }).parse(await res.text()));
}

// Test is here to make sure we didn't accidentally break something in the flow
describe('The server test setup', (): void => {
  let app: App;

  beforeAll(async(): Promise<void> => {
    app = await new AppRunner().create(
      {
        config: [
          joinFilePath(__dirname, '../../config/example.json'),
          joinFilePath(__dirname, '../../config/derived.json'),
          joinFilePath(__dirname, '../../config/main.json'),
        ],
        loaderProperties: {
          mainModulePath: joinFilePath(__dirname, '../../'),
          dumpErrorState: false,
        },
        shorthand: {
          port: 3456,
          loggingLevel: 'off',
        },
      }
    );

    await app.start();
  });

  afterAll(async(): Promise<void> => {
    await app.stop();
  });

  it('returns the derived resource.', async(): Promise<void> => {
    const res = await fetch('http://localhost:3456/test');
    const store = await responseToStore(res, 'http://localhost:3456/test');
    expect(store.countQuads(null, null, null, null)).toBe(1);
    expect(store.countQuads(
      namedNode('http://localhost:3456/selectors/data'),
      namedNode('http://xmlns.com/foaf/0.1/name'),
      literal('Example'),
      null)).toBe(1);
  });

  it('returns the contents of the derived root container.', async(): Promise<void> => {
    const res = await fetch('http://localhost:3456/');
    const store = await responseToStore(res, 'http://localhost:3456/');
    expect(store.countQuads(null, null, null, null)).toBe(5);
    const subject = namedNode('http://localhost:3456/');
    const contains = namedNode('http://www.w3.org/ns/ldp#contains');
    expect(store.countQuads(subject, contains, namedNode('http://localhost:3456/test'), null)).toBe(1);
    expect(store.countQuads(subject, contains, namedNode('http://localhost:3456/template/'), null)).toBe(1);
    expect(store.countQuads(subject, contains, namedNode('http://localhost:3456/query%7B?var%7D'), null)).toBe(1);
    expect(store.countQuads(subject, contains, namedNode('http://localhost:3456/pattern'), null)).toBe(1);
    expect(store.countQuads(subject, contains, namedNode('http://localhost:3456/multiple'), null)).toBe(1);
  });

  it('still returns original resources.', async(): Promise<void> => {
    const res = await fetch('http://localhost:3456/selectors/data');
    const store = await responseToStore(res, 'http://localhost:3456/selectors/data');
    expect(store.countQuads(null, null, null, null)).toBe(2);
    const subject = namedNode('http://localhost:3456/selectors/data');
    expect(store.countQuads(subject, namedNode('http://xmlns.com/foaf/0.1/knows'), namedNode('http://example.com/alice'), null)).toBe(1);
    expect(store.countQuads(subject, namedNode('http://xmlns.com/foaf/0.1/name'), literal('Example'), null)).toBe(1);
  });
});
