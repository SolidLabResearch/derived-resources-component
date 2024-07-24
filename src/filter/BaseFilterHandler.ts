import type { Representation } from '@solid/community-server';
import { updateModifiedDate } from '@solid/community-server';
import type { FilterExecutor } from './FilterExecutor';
import type { FilterHandlerInput } from './FilterHandler';
import { FilterHandler } from './FilterHandler';
import type { FilterParser } from './FilterParser';

/**
 * First parses the filter input into a {@link Filter} object,
 * which it then feeds into a {@link FilterExecutor}.
 *
 * Also adds timestamp en derivation metadata to the resulting {@link Representation}.
 */
export class BaseFilterHandler extends FilterHandler {
  protected readonly parser: FilterParser;
  protected readonly executor: FilterExecutor;

  public constructor(parser: FilterParser, executor: FilterExecutor) {
    super();
    this.parser = parser;
    this.executor = executor;
  }

  public async canHandle(input: FilterHandlerInput): Promise<void> {
    return this.parser.canHandle(input.config);
  }

  public async handle(input: FilterHandlerInput): Promise<Representation> {
    const filter = await this.parser.handle(input.config);
    const result = await this.executor.handleSafe({ ...input, filter });

    // Set the last modified date to the current time,
    // this to prevent issues with ETags not changing if the resource changes.
    // To generate a correct ETag we would have to consider all input sources,
    // their timestamps, same for the filter, and potential mappings.
    // CSS currently generates an ETag purely based on the timestamp,
    // so some changes would be needed there before we can even think of that.
    updateModifiedDate(result.metadata, new Date());

    // Add all the derivation metadata
    input.config.metadata.identifier = result.metadata.identifier;
    result.metadata.setMetadata(input.config.metadata);

    return result;
  }
}
