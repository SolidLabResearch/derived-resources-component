import { asyncToArray, isContainerPath, LDP, ResourceIdentifier, ResourceStore } from '@solid/community-server';
import { SelectorHandler, SelectorHandlerInput } from './SelectorHandler';

// TODO:
export class WildcardSelectorHandler extends SelectorHandler {
  protected readonly store: ResourceStore;

  public constructor(store: ResourceStore) {
    super();
    this.store = store;
  }

  public async handle({ selector }: SelectorHandlerInput): Promise<ResourceIdentifier[]> {
    return asyncToArray(this.handleSelector(selector));
  }

  protected async *handleSelector(path: string): AsyncIterable<ResourceIdentifier> {
    const match = /\/\*(?:\/|$)/.exec(path);
    if (!match) {
      return yield { path };
    }
    // There is (at least) 1 wildcard in the path
    const containerPath = path.slice(0, match.index + 1);
    const tail = path.slice(match.index + 2);

    const container = await this.store.getRepresentation({ path: containerPath }, {});
    const childPaths = container.metadata.getAll(LDP.terms.contains).map((term): string => term.value);

    // If there is no tail remaining, we are interested in the documents in this container
    if (tail.length === 0) {
      yield* childPaths.filter((child): boolean => !isContainerPath(child)).map((child): ResourceIdentifier => ({ path: child }));
    }
    const newPaths = childPaths.filter((child): boolean => isContainerPath(child)).map((child): string => child + tail);
    for (const newPath of newPaths) {
      yield* this.handleSelector(newPath);
    }
  }
}
