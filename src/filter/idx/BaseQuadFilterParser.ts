import { Quad } from '@rdfjs/types';
import { Guarded, transformSafely } from '@solid/community-server';
import { Readable } from 'node:stream';
import { QuadFilterParser, QuadFilterParserArgs } from './QuadFilterParser';

/**
 * A {@link QuadFilterParser} that removes all triples from a representation data stream
 * that do not match a given quad template.
 */
export class BaseQuadFilterParser extends QuadFilterParser {
  public async handle({ filter, representation }: QuadFilterParserArgs): Promise<Guarded<Readable>> {
    const matchFn = (quad: Quad): Quad | undefined => {
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
      transform: (data: Quad) => {
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
