import {
  createErrorMessage,
  getLoggerFor,
  NotImplementedHttpError,
  RepresentationMetadata,
} from '@solid/community-server';
import { Parser } from 'sparqljs';
import type { DerivationConfig } from '../../DerivationConfig';
import { DERIVED_TYPES } from '../../Vocabularies';
import type { Filter } from '../Filter';
import { FilterParser } from './FilterParser';

/**
 * Validates whether the filter string is a valid SPARQL query.
 */
export class SparqlFilterParser extends FilterParser<string> {
  protected readonly logger = getLoggerFor(this);

  protected readonly parser = new Parser();

  public async canHandle(input: DerivationConfig): Promise<void> {
    try {
      this.parser.parse(input.filter);
    } catch (error: unknown) {
      this.logger.debug(`Not a valid SPARQL query: ${createErrorMessage(error)}`);
      throw new NotImplementedHttpError('Only supports SPARQL filters');
    }
  }

  public async handle(input: DerivationConfig): Promise<Filter<string>> {
    return {
      data: input.filter,
      checksum: input.filter,
      type: DERIVED_TYPES.terms.Sparql,
      metadata: new RepresentationMetadata(),
    };
  }
}
