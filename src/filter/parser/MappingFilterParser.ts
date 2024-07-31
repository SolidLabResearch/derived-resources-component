import { getLoggerFor } from '@solid/community-server';
import type { DerivationConfig } from '../../DerivationConfig';
import type { Filter } from '../Filter';
import { FilterParser } from './FilterParser';

/**
 * Applies mapping values to a filter string in a {@link DerivationConfig}.
 * Replaces `$key$` strings with the corresponding value in the mappings.
 */
export class MappingFilterParser<T = unknown> extends FilterParser<T> {
  protected readonly logger = getLoggerFor(this);

  protected readonly source: FilterParser<T>;

  public constructor(source: FilterParser<T>) {
    super();
    this.source = source;
  }

  public async handle(input: DerivationConfig): Promise<Filter<T>> {
    let data = input.filter;
    // Replace vars with values
    for (const [ key, val ] of Object.entries(input.mappings)) {
      data = data.replaceAll(`$${key}$`, val);
    }
    this.logger.debug(`Applied mappings to filter ${input.filter} resulting in ${data}`);
    return this.source.handleSafe({
      ...input,
      filter: data,
    });
  }
}
