import { QueryEngine } from '@comunica/query-sparql';
import { Quad } from '@rdfjs/types';
import {
  createErrorMessage, getLoggerFor,
  Guarded,
  guardedStreamFrom,
  guardStream,
  InternalServerError,
  readableToString,
  ResourceStore
} from '@solid/community-server';
import * as asyncIt from 'asynciterator';
import { on } from 'node:events';
import { Readable } from 'node:stream';
import { FilterHandler, FilterManagerInput } from './FilterHandler';

/**
 * Filters a dataset using a SPARQL query.
 * Input mappings can be used to customize the SPARQL query.
 * If the input mapping has a key `var`, all instances of `$var$` in the query will be replaced with the mapped value.
 * The `filter` value is expected to be an identifier of a resource containing the query.
 */
export class SparqlFilterHandler extends FilterHandler {
  protected readonly logger = getLoggerFor(this);

  protected readonly store: ResourceStore;

  public constructor(store: ResourceStore) {
    super();
    this.store = store;
  }

  public async handle({ mappings, data, filter }: FilterManagerInput): Promise<Guarded<Readable>> {
    let query: string;
    try {
      const representation = await this.store.getRepresentation({ path: filter }, {});
      query = await readableToString(representation.data);
    } catch (error: unknown) {
      throw new InternalServerError(`There was a problem acquiring the filter to generate the derived resource: ${createErrorMessage(error)}`);
    }
    this.logger.debug(`Using filter ${filter} with contents ${query}`);

    // Replace vars with values
    for (const [ key, val ] of Object.entries(mappings)) {
      query = query.replaceAll(`$${key}$`, val);
    }
    this.logger.debug(`Applied mappings to filter ${filter} resulting in ${query}`);

    const engine = new QueryEngine();
    try {
      const result = await engine.queryQuads(query, { sources: [data] });
      return guardStream(Readable.from(this.convertAsyncIterator(result)));
    } catch(error: unknown) {
      throw new InternalServerError(`There was a problem applying the filter while generating the derived resource: ${createErrorMessage(error)}`);
    }
  }

  /**
   * Converts a stream from the AsyncIterator library to an async generator.
   */
  protected async *convertAsyncIterator(it: asyncIt.AsyncIterator<Quad>): AsyncIterable<Quad> {
    const dataIt = on(it, 'data');
    it.on('end', () => dataIt.return!());
    for await (const data of dataIt) {
      yield* data;
    }
  }
}
