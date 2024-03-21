import { Term } from '@rdfjs/types';
import { DC, Representation, RepresentationMetadata, updateModifiedDate } from '@solid/community-server';
import { FilterExecutor } from './FilterExecutor';
import { FilterHandler, FilterHandlerInput } from './FilterHandler';
import { FilterParser } from './FilterParser';

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

    this.setLastModified(result.metadata, input.representations);

    // Add all the derivation metadata
    input.config.metadata.identifier = result.metadata.identifier;
    result.metadata.setMetadata(input.config.metadata);

    return result;
  }

  /**
   * Sets the last-modified date of the resulting derived resource to that of the highest value in the sources.
   */
  protected setLastModified(resultMetadata: RepresentationMetadata, sourceRepresentations: Representation[]): void {
    const modifiedTimes = sourceRepresentations
      .map((representation): Term | undefined => representation.metadata.get(DC.terms.modified))
      .filter(Boolean)
      .map((term): number => new Date(term!.value).getTime())
    const lastModified = Math.max(...modifiedTimes);
    // Will be -Infinity if there were no matches
    if (lastModified > 0) {
      updateModifiedDate(resultMetadata, new Date(lastModified));
    }
  }
}
