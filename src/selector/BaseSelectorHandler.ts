import type { Representation, ResourceStore } from '@solid/community-server';
import { asyncToArray, INTERNAL_QUADS } from '@solid/community-server';
import type { DerivationConfig } from '../DerivationConfig';
import { SelectorHandler } from './SelectorHandler';
import type { SelectorParser } from './SelectorParser';

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

  public async canHandle(config: DerivationConfig): Promise<void> {
    return this.parser.canHandle(config);
  }

  public async handle(config: DerivationConfig): Promise<Representation[]> {
    return asyncToArray(this.configToRepresentations(config));
  }

  protected async* configToRepresentations(config: DerivationConfig): AsyncIterableIterator<Representation> {
    const identifiers = await this.parser.handle(config);
    for (const identifier of identifiers) {
      yield this.store.getRepresentation(identifier, { type: { [INTERNAL_QUADS]: 1 }});
    }
  }
}
