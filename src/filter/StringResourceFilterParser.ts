import {
  createErrorMessage,
  IdentifierStrategy,
  InternalServerError,
  isUrl,
  NotImplementedHttpError,
  readableToString,
  Representation,
  ResourceStore
} from '@solid/community-server';
import { DerivationConfig } from '../DerivationConfig';
import { Filter } from './Filter';
import { FilterParser } from './FilterParser';

/**
 * Extracts string data from a filter that is an internal URL.
 * Only supports URLs in scope of the server as it uses the internal {@link ResourceStore}.
 */
export class StringResourceFilterParser extends FilterParser {
  protected readonly store: ResourceStore;
  protected readonly identifierStrategy: IdentifierStrategy;

  public constructor(store: ResourceStore, identifierStrategy: IdentifierStrategy) {
    super();
    this.store = store;
    this.identifierStrategy = identifierStrategy;
  }

  public async canHandle(input: DerivationConfig): Promise<void> {
    if (!isUrl(input.filter)) {
      throw new NotImplementedHttpError('Only valid URLs are supported as filter value.');
    }
    if (!this.identifierStrategy.supportsIdentifier({ path: input.filter })){
      throw new NotImplementedHttpError(`${input.filter} is not in the scope of the server.`);
    }
  }

  public async handle(input: DerivationConfig): Promise<Filter> {
    let representation: Representation;
    let filter: string;
    try {
      representation = await this.store.getRepresentation({ path: input.filter }, {});
      filter = await readableToString(representation.data);
    } catch (error: unknown) {
      throw new InternalServerError(`There was a problem acquiring the filter to generate the derived resource: ${createErrorMessage(error)}`);
    }

    return {
      data: filter,
      metadata: representation.metadata,
    }
  }
}
