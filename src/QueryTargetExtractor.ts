import type { HttpRequest, ResourceIdentifier } from '@solid/community-server';
import { TargetExtractor } from '@solid/community-server';
import type { QueryResourceIdentifier } from './QueryResourceIdentifier';

/**
 * Uses a different {@link TargetExtractor} to generate a {@link ResourceIdentifier},
 * after which it parses the query parameters and adds those as well.
 */
export class QueryTargetExtractor extends TargetExtractor {
  protected readonly targetExtractor: TargetExtractor;

  public constructor(targetExtractor: TargetExtractor) {
    super();
    this.targetExtractor = targetExtractor;
  }

  public async canHandle(input: { request: HttpRequest }): Promise<void> {
    return this.targetExtractor.canHandle(input);
  }

  public async handle(input: { request: HttpRequest }): Promise<QueryResourceIdentifier> {
    const identifier: ResourceIdentifier = await this.targetExtractor.handle(input);
    // Base URL doesn't matter as we only care about the query string
    const url = new URL(input.request.url!, 'https://example.com/');
    return {
      ...identifier,
      query: {
        ...Object.fromEntries(url.searchParams.entries()),
      },
    };
  }
}
