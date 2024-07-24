import type { Readable } from 'node:stream';
import { PassThrough } from 'node:stream';
import type { BlankNode, Quad, Quad_Object, Term } from '@rdfjs/types';
import type {
  Representation,
} from '@solid/community-server';
import {
  BasicRepresentation,
  INTERNAL_QUADS,
  NotImplementedHttpError,
  PREFERRED_PREFIX_TERM,
  SOLID_META,
  transformSafely,
} from '@solid/community-server';
import { DataFactory, Store } from 'n3';
import { DERIVED_INDEX } from '../../Vocabularies';
import type { FilterExecutorInput } from '../FilterExecutor';
import { FilterExecutor } from '../FilterExecutor';
import type { QuadFilterParser } from './QuadFilterParser';

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
  protected readonly resourceIndexParser: QuadFilterParser;

  public constructor(resourceIndexParser: QuadFilterParser) {
    super();
    this.resourceIndexParser = resourceIndexParser;
  }

  public async canHandle({ filter, representations }: FilterExecutorInput): Promise<void> {
    if (filter.metadata.contentType !== 'application/json') {
      throw new NotImplementedHttpError('Only application/json filters are supported.');
    }

    if (typeof filter.data !== 'string') {
      throw new NotImplementedHttpError('Expected filter data to be a string.');
    }

    const json = JSON.parse(filter.data) as Record<string, unknown>;
    if (!Object.keys(json).every((key): boolean => (EXPECTED_KEYS as readonly string[]).includes(key))) {
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

    for (const representation of representations) {
      await this.resourceIndexParser.canHandle({ filter: json, representation });
    }
  }

  public async handle(input: FilterExecutorInput): Promise<Representation> {
    const filter = JSON.parse(input.filter.data as string) as Partial<Quad>;

    // Find the variable
    let position: typeof EXPECTED_KEYS[number];
    for (const key of EXPECTED_KEYS) {
      if ((filter[key] as Term | undefined)?.termType === 'Variable') {
        position = key;
      }
    }

    // We create a new store every time to reset the blank node index value
    const store = new Store();
    // We link blank nodes to matches to group all entries of the same match
    const matches: Record<string, BlankNode> = {};

    const streams = await Promise.all(input.representations.map(async(representation): Promise<Readable> => {
      const createQuads = this.createQuadFn(position, store, matches, representation.metadata.identifier);
      const data = await this.resourceIndexParser.handle({ representation, filter });
      return this.createTransform(data, createQuads);
    }));
    const merged = this.mergeStreams(streams);

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

  protected mergeStreams(streams: Readable[]): Readable {
    let count = streams.length;
    const merged = new PassThrough({ objectMode: true });
    for (const stream of streams) {
      stream.pipe(merged, { end: false });
      stream.on('error', (error): void => {
        merged.destroy(error);
      });
      stream.on('end', (): void => {
        count -= 1;
        if (count === 0) {
          merged.end();
        }
      });
    }
    return merged;
  }
}
