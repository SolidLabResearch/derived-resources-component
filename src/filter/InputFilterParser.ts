import { RepresentationMetadata } from '@solid/community-server';
import type { DerivationConfig } from '../DerivationConfig';
import type { Filter } from './Filter';
import { FilterParser } from './FilterParser';

/**
 * Returns the filter input string as output data.
 */
export class InputFilterParser extends FilterParser<string> {
  public async handle(input: DerivationConfig): Promise<Filter<string>> {
    return {
      data: input.filter,
      metadata: new RepresentationMetadata(),
    };
  }
}
