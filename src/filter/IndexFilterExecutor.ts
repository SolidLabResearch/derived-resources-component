import { BlankNode, Quad, Quad_Object, Term } from '@rdfjs/types';
import {
  BasicRepresentation,
  INTERNAL_QUADS,
  NotImplementedHttpError, PREFERRED_PREFIX_TERM,
  Representation, SOLID_META,
  transformSafely
} from '@solid/community-server';
import { DataFactory, Store } from 'n3';
import { PassThrough, Readable } from 'node:stream';
import { DERIVED_INDEX } from '../Vocabularies';
import { FilterExecutor, FilterExecutorInput } from './FilterExecutor';

const EXPECTED_KEYS = [ 'subject', 'predicate', 'object', 'graph' ];

/**
 * A {@link FilterExecutor} that generates derived index resources.
 * Supports filter resources containing a JSON object which is a partial Quad.
 * The partial Quad should contain 1 variable.
 * For every triple in the input resources that matches the filter,
 * triples will be generated indicating which resource contained the match,
 * and which value was in the variable position.
 */
export class IndexFilterExecutor extends FilterExecutor {
  public async canHandle({ filter }: FilterExecutorInput): Promise<void> {
    if (filter.metadata.contentType !== 'application/json') {
      throw new NotImplementedHttpError('Only application/json filters are supported.');
    }

    if (typeof filter.data !== 'string') {
      throw new NotImplementedHttpError('Expected filter data to be a string.');
    }

    const json = JSON.parse(filter.data);
    if (!Object.keys(json).every((key): boolean => EXPECTED_KEYS.includes(key))) {
      throw new NotImplementedHttpError('Expected a json object with keys subject, predicate, object and/or graph.');
    }

    let varCount = 0;
    for (const key of Object.keys(json)) {
      if ((json[key] as Term).termType === 'Variable') {
        varCount += 1;
      }
    }

    if (varCount !== 1) {
      throw new NotImplementedHttpError('Expected exactly 1 variable in the filter.');
    }
  }

  public async handle(input: FilterExecutorInput): Promise<Representation> {
    const filter = JSON.parse(input.filter.data as string) as Partial<Quad>;

    // We create a new store every time to reset the blank node index value
    const store = new Store();
    // We link blank nodes to matches to group all entries of the same match
    const matches: Record<string, BlankNode> = {};

    const streams = input.representations.map((representation): Readable => {
      const createQuads = this.createQuadFn(store, matches, representation.metadata.identifier);
      const matchFn = this.createMatchFn(filter, createQuads);
      return this.createTransform(representation.data, matchFn);
    });
    const merged = this.mergeStreams(streams);

    const representation = new BasicRepresentation(merged, input.config.identifier, INTERNAL_QUADS);
    representation.metadata.addQuad(DERIVED_INDEX.terms.namespace, PREFERRED_PREFIX_TERM, 'derived-index', SOLID_META.terms.ResponseMetadata);

    return representation;
  }

  protected createQuadFn(store: Store, matches: Record<string, BlankNode>, instance: Quad_Object): (match?: Quad_Object) => Quad[] {
    const cache = new Set<string>();
    return (match?: Quad_Object): Quad[] => {
      if (!match) {
        return [];
      }
      let existingNode = matches[match.value];
      if (existingNode) {
        // If this node is in the cache the relevant triples already exist
        if (cache.has(existingNode.value)) {
          return [];
        }
        cache.add(existingNode.value);

        // In case we already have a match the `for` triple has already been generated
        return [
          DataFactory.quad(existingNode, DataFactory.namedNode(DERIVED_INDEX.instance), instance)
        ];
      }
      const blankNode = store.createBlankNode();
      matches[match.value] = blankNode;
      cache.add(blankNode.value);

      return [
        DataFactory.quad(blankNode, DataFactory.namedNode(DERIVED_INDEX.for), match),
        DataFactory.quad(blankNode, DataFactory.namedNode(DERIVED_INDEX.instance), instance),
      ];
    }
  }

  protected createMatchFn(filter: Partial<Quad>, createQuads: (match?: Quad_Object) => Quad[]): (quad: Quad) => Quad[] {
    return (quad: Quad): Quad[] => {
      let match: Quad_Object | undefined;
      for (const pos of [ 'subject', 'predicate', 'object' ] as const) {
        if (filter[pos]) {
          if (filter[pos]?.termType === 'Variable') {
            match = quad[pos];
          } else if (!quad[pos].equals(filter[pos])) {
            return [];
          }
        }
      }

      return createQuads(match);
    };
  }

  protected createTransform(data: Readable, matchFn: (quad: Quad) => Quad[]): Readable {
    const transformed = transformSafely(data, {
      transform: (data: Quad) => {
        for (const match of matchFn(data)) {
          transformed.push(match);
        }
      },
      objectMode: true,
    });
    return transformed;
  }

  protected mergeStreams(streams: Readable[]): Readable {
    let count = streams.length;
    const merged = new PassThrough({ objectMode: true });
    for (const stream of streams) {
      stream.pipe(merged, { end: false });
      stream.on('error', (error) => {
        merged.destroy(error);
      })
      stream.on('end', () => {
        count -= 1;
        if (count === 0) {
          merged.end();
        }
      });
    }
    return merged;
  }
}
