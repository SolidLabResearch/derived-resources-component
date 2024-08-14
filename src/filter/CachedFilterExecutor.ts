import { createHash } from 'node:crypto';
import type { Representation } from '@solid/community-server';
import { DC, getLoggerFor } from '@solid/community-server';
import { LRUCache } from 'lru-cache';
import type {
  CachedRepresentation,
} from '../util/CacheUtil';
import {
  cachedToRepresentation,
  calculateCachedRepresentationSize,
  duplicateRepresentation,
  representationToCached,
} from '../util/CacheUtil';
import type { FilterExecutorInput } from './FilterExecutor';
import { FilterExecutor } from './FilterExecutor';

interface ChecksumCachedRepresentation extends CachedRepresentation {
  checksum: string;
}

/**
 * A {@link FilterExecutor} that caches the result for faster reuse.
 * For each cache entry, a checksum is generated based on the filter,
 * all resource identifiers, and their corresponding timestamps.
 * If the checksum of the cached entry no longer matches, it will be replaced with the current version.
 *
 * Cache settings can be set to determine the max cache entries, or the max size for the entire cache (in bytes).
 */
export class CachedFilterExecutor extends FilterExecutor {
  protected readonly logger = getLoggerFor(this);

  protected readonly source: FilterExecutor;
  protected readonly cache: LRUCache<string, ChecksumCachedRepresentation>;

  public constructor(source: FilterExecutor, cacheSettings?: { max?: number; maxSize?: number }) {
    super();
    this.source = source;
    const max = cacheSettings?.max ?? 1000;
    // 100 MB
    const maxSize = cacheSettings?.maxSize ?? 100_000_000;

    this.cache = new LRUCache({ max, maxSize, sizeCalculation: calculateCachedRepresentationSize });
  }

  public async canHandle(input: FilterExecutorInput): Promise<void> {
    return this.source.canHandle(input);
  }

  public async handle(input: FilterExecutorInput): Promise<Representation> {
    const key = input.config.identifier.path;
    const checksum = this.getChecksum(input);
    this.logger.debug(`Checking cache with key ${key} and ${checksum}`);
    // No checksum means the filter format did not allow one to be generated, so we don't attempt caching
    if (!checksum) {
      return this.source.handle(input);
    }

    const cached = this.cache.get(key);
    if (cached?.checksum === checksum) {
      this.logger.debug(`Cache hit with key ${key} and checksum ${checksum}`);
      return cachedToRepresentation(cached);
    }

    const representation = await this.source.handle(input);
    return this.cacheRepresentation(key, checksum, representation);
  }

  /**
   * Cache the given representation with the given key/checksum.
   * Returns a representation that can be used instead of the one given as input,
   * as that one will be read during the caching.
   * Caching will be done async, to prevent blocking the result while caching is in progress.
   */
  protected cacheRepresentation(key: string, checksum: string, representation: Representation): Representation {
    const [ copy1, copy2 ] = duplicateRepresentation(representation);
    // Don't await so the result can immediately be returned while caching
    representationToCached(copy1).then((newCached): void => {
      if (newCached) {
        this.cache.set(key, { ...newCached, checksum });
      }
    }).catch((): void => {});
    return copy2;
  }

  /**
   * Generates a checksum based on the filter/resources/timestamps,
   * ensuring this value changes if anything impacting the derived resource changes.
   */
  protected getChecksum(input: FilterExecutorInput): string | undefined {
    if (!input.filter.checksum) {
      return;
    }

    const resourceKeys = input.representations.map((representation): string => {
      const id = representation.metadata.identifier.value;
      const timestamp = representation.metadata.get(DC.terms.modified)?.value;
      return `${id}:${timestamp}`;
    });
    resourceKeys.sort();

    return createHash('md5').update(`${input.filter.checksum} ${resourceKeys.join(' ')}`).digest('hex');
  }
}
