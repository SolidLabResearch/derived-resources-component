import { QueryEngine } from '@comunica/query-sparql';
import { Quad } from '@rdfjs/types';
import { Guarded, guardedStreamFrom, guardStream, readableToString, ResourceStore } from '@solid/community-server';
import * as asyncIt from 'asynciterator';
import { on } from 'node:events';
import { Readable } from 'node:stream';
import { FilterHandler, FilterManagerInput } from './FilterHandler';

// TODO: could validate that filter is a URI

// TODO:
export class SparqlFilterHandler extends FilterHandler {
  protected readonly store: ResourceStore;

  public constructor(store: ResourceStore) {
    super();
    this.store = store;
  }

  public async handle({ mappings, data, filter }: FilterManagerInput): Promise<Guarded<Readable>> {
    // TODO: safety checks
    let query = await readableToString((await this.store.getRepresentation({ path: filter }, {})).data);

    // Replace vars with values
    for (const [ key, val ] of Object.entries(mappings)) {
      query = query.replaceAll(`$${key}$`, val);
    }

    const engine = new QueryEngine();
    // TODO: can error
    const result = await engine.queryQuads(query, { sources: [ data ] });
    return guardStream(Readable.from(this.convertAsyncIterator(result)));
  }

  // TODO:
  protected async *convertAsyncIterator(it: asyncIt.AsyncIterator<Quad>): AsyncIterable<Quad> {
    const dataIt = on(it, 'data');
    it.on('end', () => dataIt.return!());
    for await (const data of dataIt) {
      yield* data;
    }
  }
}
