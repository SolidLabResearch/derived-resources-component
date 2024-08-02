import {
  createErrorMessage,
  getLoggerFor,
  InternalServerError,
  NotImplementedHttpError,
  RepresentationMetadata,
} from '@solid/community-server';
import { Parser, Store } from 'n3';
import type { DerivationConfig } from '../../DerivationConfig';
import { DERIVED_TYPES } from '../../Vocabularies';
import type { Filter } from '../Filter';
import { FilterParser } from './FilterParser';

/**
 * Interprets the config filter string as turtle and parses it into an N3.js store.
 * Parsing already happens in the `canHandle` call as the parsing is used to verify if the input is valid turtle.
 * The intermediate result is stored in a {@link WeakMap} to return on the `handle` call.
 */
export class QuadFilterParser extends FilterParser<Store> {
  protected readonly logger = getLoggerFor(this);

  protected readonly cache = new WeakMap<DerivationConfig, Store>();

  public async canHandle(input: DerivationConfig): Promise<void> {
    const parser = new Parser();
    try {
      const quads = parser.parse(input.filter);
      this.cache.set(input, new Store(quads));
    } catch (error: unknown) {
      this.logger.debug(`Unable to parse filter to quads: ${createErrorMessage(error)}`);
      throw new NotImplementedHttpError('Only valid turtle input is accepted');
    }
  }

  public async handle(input: DerivationConfig): Promise<Filter<Store>> {
    const store = this.cache.get(input);
    if (!store) {
      throw new InternalServerError('Calling handle before calling canHandle');
    }
    return {
      data: store,
      type: DERIVED_TYPES.terms.Store,
      checksum: input.filter,
      metadata: new RepresentationMetadata(),
    };
  }
}
