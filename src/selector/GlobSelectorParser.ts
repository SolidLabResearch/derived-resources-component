import type {
  ResourceIdentifier,
  ResourceStore,
} from '@solid/community-server';
import {
  asyncToArray,
  getLoggerFor,
  isContainerPath,
  LDP,
} from '@solid/community-server';
import type { DerivationConfig } from '../DerivationConfig';
import { SelectorParser } from './SelectorParser';

export interface GlobParameters {
  glob: string;
  head: string;
  tail: string;
  childPaths: string[];
}

/**
 * Interprets selectors as resource identifiers.
 * The selector can contain glob patterns `*` or `**`.
 * How these are interpreted is based on https://www.digitalocean.com/community/tools/glob.
 */
export class GlobSelectorParser extends SelectorParser {
  protected readonly logger = getLoggerFor(this);

  protected readonly store: ResourceStore;

  public constructor(store: ResourceStore) {
    super();
    this.store = store;
  }

  public async handle({ selectors }: DerivationConfig): Promise<ResourceIdentifier[]> {
    const promises = selectors.map(async(selector): Promise<ResourceIdentifier[]> =>
      asyncToArray(this.handleSelector(selector)));

    return (await Promise.all(promises)).flat();
  }

  protected async* handleSelector(path: string): AsyncIterable<ResourceIdentifier> {
    const match = /\*\*?/u.exec(path);
    if (!match) {
      if (await this.store.hasResource({ path })) {
        this.logger.debug(`Returning selector ${path} as an identifier`);
        return yield { path };
      }
      return;
    }
    // There is (at least) 1 glob pattern in the path
    const head = path.slice(0, match.index);
    const glob = match[0];
    const tail = path.slice(match.index + glob.length);

    const containerPath = head.slice(0, head.lastIndexOf('/') + 1);
    const container = await this.store.getRepresentation({ path: containerPath }, {});
    const childPaths = container.metadata.getAll(LDP.terms.contains).map((term): string => term.value);
    const params: GlobParameters = { glob, head, tail, childPaths };

    if (!head.endsWith('/') || (tail.length > 0 && !tail.startsWith('/'))) {
      yield* this.handleInternalGlob(params);
    } else if (glob === '**') {
      yield* this.handleDouble(params);
    } else if (glob === '*') {
      yield* this.handleSingle(params);
    }
  }

  /**
   * Handles the case of having a `*` or `**` next to non-`/` characters.
   * E.g., `/foo/*.js`.
   * `**` is treated identical as `*` in this case.
   */
  protected async* handleInternalGlob({ glob, head, tail, childPaths }: GlobParameters):
  AsyncIterable<ResourceIdentifier> {
    const parts = tail.split('/');
    const subTail = parts[0].slice(glob.length) + (parts.length > 1 ? '/' : '');
    // In case there are still characters remaining, we should only find the containers and append them
    const rest = parts.slice(1).join('/');

    this.logger.debug(`Recursively handling all paths starting with "${head}" and ending with "${subTail}"`);
    for (const child of childPaths) {
      if (child.startsWith(head) && child.endsWith(subTail)) {
        yield* this.handleSelector(`${child}${rest}`);
      }
    }
  }

  /**
   * Handles the case of having a `**` in the path.
   */
  protected async* handleDouble({ head, tail, childPaths }: GlobParameters): AsyncIterable<ResourceIdentifier> {
    // Just removing the `**`
    yield* this.handleSelector(`${head}${tail.slice(1)}`);

    for (const child of childPaths) {
      if (isContainerPath(child)) {
        this.logger.debug(`Recursively handling all paths matching ${child}**${tail}`);
        yield* this.handleSelector(`${child}**${tail}`);
      } else if (tail.length === 0) {
        // Only yielding documents here as the containers will be yielded in the recursive call above
        yield* this.handleSelector(child);
      }
    }
  }

  /**
   * Handles the case of having a `*` in the path.
   */
  protected async* handleSingle({ tail, childPaths }: GlobParameters): AsyncIterable<ResourceIdentifier> {
    for (const child of childPaths) {
      if (isContainerPath(child) && tail.length > 0) {
        this.logger.debug(`Recursively handling all paths matching ${child}${tail.slice(1)}`);
        yield* this.handleSelector(`${child}${tail.slice(1)}`);
      } else if (tail.length === 0) {
        yield* this.handleSelector(child);
      }
    }
  }
}
