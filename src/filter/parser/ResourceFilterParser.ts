import type {
  IdentifierStrategy,
  Representation,
  ResourceStore,
} from '@solid/community-server';
import {
  createErrorMessage,
  InternalServerError,
  isUrl,
  NotImplementedHttpError,
  readableToString,
} from '@solid/community-server';
import type { DerivationConfig } from '../../DerivationConfig';
import type { Filter } from '../Filter';
import { FilterParser } from './FilterParser';

/**
 * Interprets the filter string from a {@link DerivationConfig} as the URL of a resource.
 * The contents of that resource will then be passed along to the next parser.
 * Only supports resources stored in the given {@link ResourceStore}.g
 */
export class ResourceFilterParser<T = unknown> extends FilterParser<T> {
  public constructor(
    protected readonly source: FilterParser<T>,
    protected readonly store: ResourceStore,
    protected readonly identifierStrategy: IdentifierStrategy,
  ) {
    super();
  }

  public async canHandle(input: DerivationConfig): Promise<void> {
    if (!isUrl(input.filter)) {
      throw new NotImplementedHttpError('Only valid URLs are supported as filter value.');
    }
    if (!this.identifierStrategy.supportsIdentifier({ path: input.filter })) {
      throw new NotImplementedHttpError(`${input.filter} is not in the scope of the server.`);
    }
  }

  public async handle(input: DerivationConfig): Promise<Filter<T>> {
    let representation: Representation;
    let filterData: string;
    try {
      representation = await this.store.getRepresentation({ path: input.filter }, {});
      filterData = await readableToString(representation.data);
    } catch (error: unknown) {
      throw new InternalServerError(
        `There was a problem acquiring the filter to generate the derived resource: ${createErrorMessage(error)}`,
      );
    }

    const filter = await this.source.handleSafe({
      ...input,
      filter: filterData,
    });

    filter.metadata.identifier = representation.metadata.identifier;
    representation.metadata.setMetadata(filter.metadata);

    return {
      ...filter,
      metadata: representation.metadata,
    };
  }
}
