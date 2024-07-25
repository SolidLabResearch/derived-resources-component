import type { Readable } from 'node:stream';
import type { Quad } from '@rdfjs/types';
import type { Guarded } from '@solid/community-server';
import { transformSafely } from '@solid/community-server';
import type { QuadPatternExecutorArgs } from './QuadPatternExecutor';
import { QuadPatternExecutor } from './QuadPatternExecutor';

/**
 * A {@link QuadPatternExecutor} that removes all triples from a representation data stream
 * that do not match a given quad template.
 */
export class BaseQuadPatternExecutor extends QuadPatternExecutor {
  public async handle({ filter, representation }: QuadPatternExecutorArgs): Promise<Guarded<Readable>> {
    function matchFn(quad: Quad): Quad | undefined {
      let match: Quad | undefined;
      for (const pos of [ 'subject', 'predicate', 'object', 'graph' ] as const) {
        if (filter[pos]) {
          if (filter[pos]?.termType === 'Variable') {
            match = quad;
          } else if (!quad[pos].equals(filter[pos])) {
            return;
          }
        }
      }
      return match;
    }

    const transform = transformSafely(representation.data, {
      transform: (data: Quad): void => {
        const match = matchFn(data);
        if (match) {
          transform.push(match);
        }
      },
      objectMode: true,
    });
    return transform;
  }
}
