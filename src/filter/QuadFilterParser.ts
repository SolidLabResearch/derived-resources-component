import {
  createErrorMessage,
  getLoggerFor,
  InternalServerError,
  NotImplementedHttpError,
  RepresentationMetadata,
} from '@solid/community-server';
import { Parser, Store } from 'n3';
import type { DerivationConfig } from '../DerivationConfig';
import type { Filter } from './Filter';
import { FilterParser } from './FilterParser';

// TODO:
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
      metadata: new RepresentationMetadata(),
    };
  }
}
