import { getLoggerFor, NotImplementedHttpError, Representation } from '@solid/community-server';
import { FilterExecutor, FilterExecutorInput } from './FilterExecutor';

/**
 * Applies mapping values to a {@link Filter object}.
 * Assumes the filter data is a string.
 * Replaces `$key$` strings with the corresponding value in the mappings.
 */
export class MappingFilterExecutor extends FilterExecutor {
  protected readonly logger = getLoggerFor(this);

  protected readonly source: FilterExecutor;

  public constructor(source: FilterExecutor) {
    super();
    this.source = source;
  }

  public async canHandle(input: FilterExecutorInput): Promise<void> {
    if (typeof input.filter.data !== 'string') {
      throw new NotImplementedHttpError('Expected filter data to be a string.');
    }

    return this.source.canHandle(input);
  }

  public async handle(input: FilterExecutorInput): Promise<Representation> {
    let data = input.filter.data as string;
    // Replace vars with values
    for (const [ key, val ] of Object.entries(input.config.mappings)) {
      data = data.replaceAll(`$${key}$`, val);
    }
    this.logger.debug(`Applied mappings to filter ${input.filter.data} resulting in ${data}`);
    return this.source.handle({
      ...input,
      filter: {
        ...input.filter,
        data,
      }
    });
  }
}
