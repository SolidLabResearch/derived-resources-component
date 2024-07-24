import type { Readable } from 'node:stream';
import { PassThrough } from 'node:stream';
import type { Quad } from '@rdfjs/types';
import type { Guarded } from '@solid/community-server';
import { DC, getLoggerFor, guardedStreamFrom, InternalServerError, pipeSafely } from '@solid/community-server';
import { LRUCache } from 'lru-cache';
import { termToString } from 'rdf-string';
import type { QuadFilterParserArgs } from './QuadFilterParser';
import { QuadFilterParser } from './QuadFilterParser';

interface CachedQuads {
  quads: Quad[];
  checksum: string;
}

function sizeCalculation({ quads }: CachedQuads): number {
  let size = 1;
  for (const quad of quads) {
    size += quad.subject.value.length;
    size += quad.predicate.value.length;
    size += quad.object.value.length;
    size += quad.graph.value.length;
  }
  return size;
}

/**
 * A {@link QuadFilterParser} that caches results.
 * The identifier, the last time the resource was modified and the filter are combined to generate a checksum.
 * If the checksum of the cached entry no longer matches, it will be replaced with the current version
 *
 * Cache settings can be set to determine the max cache entries, or the max size for the entire cache (in bytes).
 */
export class CachedQuadFilterParser extends QuadFilterParser {
  protected readonly logger = getLoggerFor(this);

  protected readonly source: QuadFilterParser;
  protected readonly cache: LRUCache<string, CachedQuads>;

  public constructor(source: QuadFilterParser, cacheSettings?: { max?: number; maxSize?: number }) {
    super();
    this.source = source;
    const max = cacheSettings?.max ?? 1000;
    // 100MB
    const maxSize = cacheSettings?.maxSize ?? 100_000_000;
    this.cache = new LRUCache({ max, maxSize, sizeCalculation });
  }

  public async canHandle(input: QuadFilterParserArgs): Promise<void> {
    return this.source.canHandle(input);
  }

  public async handle(input: QuadFilterParserArgs): Promise<Guarded<Readable>> {
    const key = this.getKey(input);
    const checksum = this.getChecksum(input);
    this.logger.debug(`Checking cache with key ${key} and checksum ${checksum}`);

    const cached = this.cache.get(key);
    if (cached && cached.checksum === checksum) {
      this.logger.debug(`Cache hit with key ${key} and checksum ${checksum}`);
      return guardedStreamFrom(cached.quads, { objectMode: true });
    }

    const result = await this.source.handle(input);
    // Pipe the stream twice, so we have 2 copies, one for the cache and one to return
    this.cacheResult(key, checksum, pipeSafely(result, new PassThrough({ objectMode: true })));
    return pipeSafely(result, new PassThrough({ objectMode: true }));
  }

  /**
   * Generates the key based on the identifier/filter.
   */
  protected getKey(input: QuadFilterParserArgs): string {
    const subject = termToString(input.filter.subject);
    const predicate = termToString(input.filter.predicate);
    const object = termToString(input.filter.object);
    const graph = termToString(input.filter.graph);
    return `${input.representation.metadata.identifier.value} ${subject} ${predicate} ${object} ${graph}`;
  }

  /**
   * Generates the checksum based on the timestamp.
   */
  protected getChecksum(input: QuadFilterParserArgs): string {
    const timestamp = input.representation.metadata.get(DC.terms.modified)?.value;
    if (!timestamp) {
      throw new InternalServerError(
        'Index caching is only possible for backends that return a last modified timestamp.',
      );
    }
    return timestamp;
  }

  /**
   * Reads the data stream to add it to the cache with the given key.
   */
  protected cacheResult(key: string, checksum: string, data: Readable): void {
    const quads: Quad[] = [];
    data.on('data', (quad: Quad): void => {
      quads.push(quad);
    });
    data.on('end', (): void => {
      this.cache.set(key, { checksum, quads });
    });
  }
}
