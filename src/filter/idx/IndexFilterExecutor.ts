import type { Readable } from 'node:stream';
import type { BlankNode, Quad, Quad_Object, Term } from '@rdfjs/types';
import type { Representation } from '@solid/community-server';
import {
  BasicRepresentation,
  INTERNAL_QUADS,
  NotImplementedHttpError,
  PREFERRED_PREFIX_TERM,
  SOLID_META,
  transformSafely,
} from '@solid/community-server';
import { DataFactory, Store } from 'n3';
import { mergeStreams } from '../../util/StreamUtil';
import { DERIVED_INDEX, DERIVED_TYPES } from '../../Vocabularies';
import type { FilterExecutorInput } from '../FilterExecutor';
import { FilterExecutor } from '../FilterExecutor';
import type { QuadPatternExecutor } from './QuadPatternExecutor';

const EXPECTED_KEYS = [ 'subject', 'predicate', 'object', 'graph' ] as const;

/**
 * A {@link FilterExecutor} that generates derived index resources.
 * Supports filter resources containing a JSON object which is a partial Quad.
 * The partial Quad should contain 1 variable.
 * For every triple in the input resources that matches the filter,
 * triples will be generated indicating which resource contained the match,
 * and which value was in the variable position.
 */
export class IndexFilterExecutor extends FilterExecutor {
  protected readonly quadPatternExecutor: QuadPatternExecutor;

  public constructor(quadPatternExecutor: QuadPatternExecutor) {
    super();
    this.quadPatternExecutor = quadPatternExecutor;
  }

  public async canHandle({ filter, representations }: FilterExecutorInput<Partial<Quad>>): Promise<void> {
    if (!filter.type.equals(DERIVED_TYPES.terms.QuadPattern)) {
      throw new NotImplementedHttpError('Only supports Quad pattern filters');
    }

    let varCount = 0;
    for (const key of Object.keys(filter.data) as (keyof Quad)[]) {
      if ((filter.data[key] as Term).termType === 'Variable') {
        varCount += 1;
      }
    }

    if (varCount !== 1) {
      throw new NotImplementedHttpError('Expected exactly 1 variable in the filter.');
    }

    for (const representation of representations) {
      await this.quadPatternExecutor.canHandle({ filter: filter.data, representation });
    }
  }

  public async handle(input: FilterExecutorInput<Partial<Quad>>): Promise<Representation> {
    // Find the variable
    let position: typeof EXPECTED_KEYS[number];
    for (const key of EXPECTED_KEYS) {
      if ((input.filter.data[key] as Term | undefined)?.termType === 'Variable') {
        position = key;
      }
    }

    // We create a new store every time to reset the blank node index value
    const store = new Store();
    // We link blank nodes to matches to group all entries of the same match
    const matches: Record<string, BlankNode> = {};

    const streams = await Promise.all(input.representations.map(async(representation): Promise<Readable> => {
      const createQuads = this.createQuadFn(position, store, matches, representation.metadata.identifier);
      const data = await this.quadPatternExecutor.handle({ representation, filter: input.filter.data });
      return this.createTransform(data, createQuads);
    }));
    const merged = mergeStreams(streams);

    const representation = new BasicRepresentation(merged, input.config.identifier, INTERNAL_QUADS);
    representation.metadata.addQuad(
      DERIVED_INDEX.terms.namespace,
      PREFERRED_PREFIX_TERM,
      'derived-index',
      SOLID_META.terms.ResponseMetadata,
    );

    return representation;
  }

  protected createQuadFn(
    position: typeof EXPECTED_KEYS[number],
    store: Store,
    matches: Record<string, BlankNode>,
    instance: Quad_Object,
  ): (quad: Quad) => Quad[] {
    return (quad: Quad): Quad[] => {
      const existingNode = matches[quad[position].value];
      if (existingNode) {
        // If we already have a match, the `derived-index:for` triple has already been generated
        return [
          DataFactory.quad(existingNode, DataFactory.namedNode(DERIVED_INDEX.instance), instance),
        ];
      }
      const blankNode = store.createBlankNode();
      matches[quad[position].value] = blankNode;

      return [
        DataFactory.quad(blankNode, DataFactory.namedNode(DERIVED_INDEX.for), quad[position] as Quad_Object),
        DataFactory.quad(blankNode, DataFactory.namedNode(DERIVED_INDEX.instance), instance),
      ];
    };
  }

  protected createTransform(data: Readable, quadFn: (quad: Quad) => Quad[]): Readable {
    const transformed = transformSafely(data, {
      transform: (data: Quad): void => {
        for (const quads of quadFn(data)) {
          transformed.push(quads);
        }
      },
      objectMode: true,
    });
    return transformed;
  }
}
