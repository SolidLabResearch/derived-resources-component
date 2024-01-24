import {
  asyncToArray,
  getLoggerFor,
  isContainerPath,
  LDP,
  ResourceIdentifier,
  ResourceStore
} from '@solid/community-server';
import { SelectorHandler, SelectorHandlerInput } from './SelectorHandler';

/**
 * Interprets selectors as resource identifiers.
 * The selector can also contain wildcards in the form of `*`,
 * in which cases all documents in a container can be selected.
 * For example, `http://localhost:3000/foo/\*` will select all documents in the `http://localhost:3000/foo/` container.
 * Values can be appended to the wildcard.
 * For example `http://localhost:3000/foo/*\/bar` will result in all resources that match the given pattern.
 */
export class WildcardSelectorHandler extends SelectorHandler {
  protected readonly logger = getLoggerFor(this);

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
      this.logger.debug(`Returning selector ${path} as an identifier`);
      return yield { path };
    }
    // There is (at least) 1 wildcard in the path
    const containerPath = path.slice(0, match.index + 1);
    const tail = path.slice(match.index + 2);

    const container = await this.store.getRepresentation({ path: containerPath }, {});
    const childPaths = container.metadata.getAll(LDP.terms.contains).map((term): string => term.value);

    // If there is no tail remaining, we are interested in the documents in this container
    if (tail.length === 0) {
      this.logger.debug(`Returning all children of ${container} as identifiers`);
      yield* childPaths.filter((child): boolean => !isContainerPath(child)).map((child): ResourceIdentifier => ({ path: child }));
    } else {
      const newPaths = childPaths.filter((child): boolean => isContainerPath(child)).map((child): string => child + tail);
      this.logger.debug(`Recursively applying tail ${tail} to all containers in ${container}`);
      for (const newPath of newPaths) {
        yield* this.handleSelector(newPath);
      }
    }
  }
}
