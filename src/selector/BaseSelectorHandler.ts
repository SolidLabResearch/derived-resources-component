import {
  asyncToArray,
  INTERNAL_QUADS,
  Representation,
  ResourceIdentifier,
  ResourceStore
} from '@solid/community-server';
import { DerivationConfig } from '../DerivationConfig';
import { SelectorHandler } from './SelectorHandler';
import { SelectorParser } from './SelectorParser';

/**
 * Determines all the input resources by calling a {@link SelectorParser}
 * and then acquires their representations through the {@link ResourceStore}.
 */
export class BaseSelectorHandler extends SelectorHandler {
  protected readonly parser: SelectorParser;
  protected readonly store: ResourceStore;

  public constructor(parser: SelectorParser, store: ResourceStore) {
    super();
    this.parser = parser;
    this.store = store;
  }

  public async canHandle({ mappings, selectors }: DerivationConfig): Promise<void> {
    await Promise.all(selectors.map((selector): Promise<void> => this.parser.canHandle({ mappings, selector  })));
  }

  public async handle(config: DerivationConfig): Promise<Representation[]> {
    return asyncToArray(this.configToRepresentations(config));
  }

  protected async* configToRepresentations({ mappings, selectors }: DerivationConfig): AsyncIterableIterator<Representation> {
    for (const selector of selectors) {
      yield* this.handleSelector(selector, mappings);
    }
  }

  protected async* handleSelector(selector: string, mappings: Record<string, string>): AsyncIterableIterator<Representation> {
    const identifiers = await this.parser.handle({ selector, mappings });
    for (const identifier of identifiers) {
      yield this.store.getRepresentation(identifier, { type: { [INTERNAL_QUADS]: 1 }});
    }
  }
}
