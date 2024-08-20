import { Readable } from 'node:stream';
import type { NamedNode, Quad } from '@rdfjs/types';
import type {
  Representation,
  ResourceIdentifier,
} from '@solid/community-server';
import {
  BasicRepresentation,
  INTERNAL_QUADS,
  NotImplementedHttpError,
  readableToQuads,
} from '@solid/community-server';
import { DataFactory } from 'n3';
import { stringToTerm } from 'rdf-string';
import { isQueryResourceIdentifier } from '../../QueryResourceIdentifier';
import { mergeStreams, take } from '../../util/StreamUtil';
import { DERIVED_TYPES, FOAF, HYDRA, RDF, SD, VOID } from '../../Vocabularies';
import type { FilterExecutorInput } from '../FilterExecutor';
import { FilterExecutor } from '../FilterExecutor';
import type { QuadPatternExecutor } from './QuadPatternExecutor';

const { quad, namedNode, literal, blankNode, defaultGraph } = DataFactory;

// Variable mappings for the QPF endpoint.
const VAR_POSITIONS = {
  s: 'subject',
  p: 'predicate',
  o: 'object',
  g: 'graph',
} as const;

// Graph that contains the metadata
const graph = namedNode('meta');
// Graph term that needs to be used if the query only wants results from the default graph
const defaultGraphParam = namedNode('urn:default');
const search = blankNode();
const subjectNode = blankNode();
const predicateNode = blankNode();
const objectNode = blankNode();
const graphNode = blankNode();
const fixedMetaQuads: Quad[] = [
  quad(search, HYDRA.terms.mapping, subjectNode, graph),
  quad(subjectNode, HYDRA.terms.variable, literal('s'), graph),
  quad(subjectNode, HYDRA.terms.property, RDF.terms.subject, graph),
  quad(search, HYDRA.terms.mapping, predicateNode, graph),
  quad(predicateNode, HYDRA.terms.variable, literal('p'), graph),
  quad(predicateNode, HYDRA.terms.property, RDF.terms.predicate, graph),
  quad(search, HYDRA.terms.mapping, objectNode, graph),
  quad(objectNode, HYDRA.terms.variable, literal('o'), graph),
  quad(objectNode, HYDRA.terms.property, RDF.terms.object, graph),
  quad(search, HYDRA.terms.mapping, graphNode, graph),
  quad(graphNode, HYDRA.terms.variable, literal('g'), graph),
  quad(graphNode, HYDRA.terms.property, SD.terms.graph, graph),
];

/**
 * A {@link FilterExecutor} exposing a QPF endpoint.
 * Due to the streaming nature of how data is used,
 * the response will always be a single page with all results.
 * For the same reason, the triple count will always be set to 1 million.
 *
 * To somewhat circumvent the latter issue,
 * a set amount of triples will be read into memory from the data stream,
 * before we generate the result stream.
 * If this causes the entire stream to be read,
 * we can give an accurate count result,
 * meaning only large result streams will have inaccurate results.
 * By default, this value is set to 1000.
 * It can be set to 0 to always first read all results into memory for an accurate count.
 */
export class QpfFilterExecutor extends FilterExecutor {
  protected readonly quadPatternExecutor: QuadPatternExecutor;
  protected readonly quadLimit: number;

  public constructor(quadFilterParser: QuadPatternExecutor, quadLimit = 1000) {
    super();
    this.quadPatternExecutor = quadFilterParser;
    this.quadLimit = quadLimit;
  }

  public async canHandle({ representations, filter }: FilterExecutorInput): Promise<void> {
    if (!filter.type.equals(DERIVED_TYPES.terms.QPF)) {
      throw new NotImplementedHttpError('Only QPF filter bodies are supported.');
    }

    for (const representation of representations) {
      await this.quadPatternExecutor.canHandle({ filter: {}, representation });
    }
  }

  public async handle({ representations, config }: FilterExecutorInput): Promise<Representation> {
    const filter = this.generateFilter(isQueryResourceIdentifier(config.identifier) ? config.identifier.query : {});

    const streams = await Promise.all(representations.map(
      async(representation): Promise<Readable> => this.quadPatternExecutor.handle({ filter, representation }),
    ));
    let merged = mergeStreams(streams);
    // Checking if the amount of resulting triples is low enough to load into memory to have exact size numbers
    let size: number | undefined;
    if (this.quadLimit === 0) {
      const data = await readableToQuads(merged);
      size = data.size;
      merged = Readable.from(data.getQuads(null, null, null, null));
    } else {
      const { head, tail } = await take(merged, this.quadLimit);
      if (tail.readableEnded) {
        merged = Readable.from(head);
        size = head.length;
      } else {
        merged = mergeStreams(Readable.from(head), tail);
      }
    }

    const metaQuads = this.getMetaQuads(config.identifier, size);
    const metaStream = Readable.from(metaQuads);

    return new BasicRepresentation(mergeStreams(metaStream, merged), config.identifier, INTERNAL_QUADS);
  }

  protected generateFilter(mappings: Partial<Record<string, string>>): Partial<Quad> {
    const result: Partial<Quad> = {};
    for (const [ key, pos ] of Object.entries(VAR_POSITIONS)) {
      if (mappings[key]) {
        if (pos === 'graph' && mappings[key] === defaultGraphParam.value) {
          result[pos] = defaultGraph();
        } else {
          // Not actually correct but let's just assume this is good enough
          result[pos] = stringToTerm(mappings[key]) as NamedNode;
        }
      }
    }
    return result;
  }

  protected getMetaQuads(identifier: ResourceIdentifier, size = 1_000_000): Quad[] {
    // Empty string is the identifier of the resource
    const fragment = namedNode('');
    const dataset = namedNode(`${identifier.path}#dataset`);
    return [
      quad(graph, FOAF.terms.primaryTopic, fragment, graph),
      quad(fragment, VOID.terms.triples, literal(size), graph),
      quad(fragment, HYDRA.terms.totalItems, literal(size), graph),
      quad(dataset, VOID.terms.subset, fragment, graph),
      quad(dataset, SD.terms.defaultGraph, defaultGraphParam, graph),
      quad(dataset, HYDRA.terms.search, search, graph),
      quad(search, HYDRA.terms.template, literal(`${identifier.path}{?s,p,o,g}`), graph),
      ...fixedMetaQuads,
    ];
  }
}
