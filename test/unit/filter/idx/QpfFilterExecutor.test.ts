import type { Readable } from 'node:stream';
import { DataFactory, Parser } from 'n3';
import type { Quad } from '@rdfjs/types';
import type { Guarded } from '@solid/community-server';
import {
  BasicRepresentation,
  guardedStreamFrom,
  INTERNAL_QUADS,
  NotImplementedHttpError,
  readableToQuads,
  RepresentationMetadata,
} from '@solid/community-server';
import type { FilterExecutorInput } from '../../../../src/filter/FilterExecutor';
import { QpfFilterExecutor } from '../../../../src/filter/idx/QpfFilterExecutor';
import type { QuadPatternExecutor } from '../../../../src/filter/idx/QuadPatternExecutor';
import type { QueryResourceIdentifier } from '../../../../src/QueryResourceIdentifier';
import { DERIVED_TYPES, FOAF, HYDRA, RDF, SD, VOID } from '../../../../src/Vocabularies';
import namedNode = DataFactory.namedNode;

describe('QpfFilterExecutor', (): void => {
  let quads: Quad[];
  let input: FilterExecutorInput<string>;
  let quadPatternExecutor: jest.Mocked<QuadPatternExecutor>;
  let executor: QpfFilterExecutor;

  beforeEach(async(): Promise<void> => {
    quads = new Parser().parse(`
      @prefix : <http://example.com/>.
      :foo a :type;
           :likes :apples.
    `);

    input = {
      config: {
        identifier: { path: 'http://example.com/foo', query: { s: 'http://example.com/s' }} as QueryResourceIdentifier,
        mappings: {},
        filter: 'qpf',
        selectors: [],
        metadata: new RepresentationMetadata(),
      },
      filter: {
        type: DERIVED_TYPES.terms.QPF,
        data: '',
        checksum: '',
        metadata: new RepresentationMetadata(),
      },
      representations: [ new BasicRepresentation() ],
    };

    quadPatternExecutor = {
      canHandle: jest.fn(),
      handle: jest.fn(async(): Promise<Guarded<Readable>> => guardedStreamFrom(quads)),
    } satisfies Partial<QuadPatternExecutor> as any;

    executor = new QpfFilterExecutor(quadPatternExecutor);
  });

  it('can only handle QPF filter objects.', async(): Promise<void> => {
    await expect(executor.canHandle(input)).resolves.toBeUndefined();

    input.filter.type = DERIVED_TYPES.terms.String;
    await expect(executor.canHandle(input)).rejects.toThrow(NotImplementedHttpError);
  });

  it('returns QPF triples with the data.', async(): Promise<void> => {
    const result = await executor.handle(input);
    expect(quadPatternExecutor.handle).toHaveBeenCalledTimes(1);
    expect(quadPatternExecutor.handle.mock.calls[0][0].filter.subject!.equals(namedNode('http://example.com/s'))).toBe(true);
    expect(quadPatternExecutor.handle.mock.calls[0][0].representation).toBe(input.representations[0]);

    expect(result.metadata.contentType).toBe(INTERNAL_QUADS);
    expect(result.metadata.identifier.value).toEqual(input.config.identifier.path);
    const store = await readableToQuads(result.data);

    const graph = store.getSubjects(FOAF.terms.primaryTopic, '', null)[0];
    expect(store.getObjects('', VOID.terms.triples, graph)[0].value).toBe('2');
    expect(store.getObjects('', HYDRA.terms.totalItems, graph)[0].value).toBe('2');

    const dataset = store.getSubjects(VOID.terms.subset, '', graph)[0];
    expect(store.getObjects(dataset, SD.terms.defaultGraph, graph)[0].value).toBe('urn:default');

    const search = store.getObjects(dataset, HYDRA.terms.search, graph)[0];
    expect(store.getObjects(search, HYDRA.terms.template, graph)[0].value).toBe('http://example.com/foo{?s,p,o,g}');

    const mappingNodes = store.getObjects(search, HYDRA.terms.mapping, graph);
    const subjectNode = store.getSubjects(HYDRA.terms.property, RDF.terms.subject, graph)[0];
    expect(mappingNodes).toContainEqual(subjectNode);
    expect(store.getObjects(subjectNode, HYDRA.terms.variable, graph)[0].value).toBe('s');
    const predicateNode = store.getSubjects(HYDRA.terms.property, RDF.terms.predicate, graph)[0];
    expect(mappingNodes).toContainEqual(predicateNode);
    expect(store.getObjects(predicateNode, HYDRA.terms.variable, graph)[0].value).toBe('p');
    const objectNode = store.getSubjects(HYDRA.terms.property, RDF.terms.object, graph)[0];
    expect(mappingNodes).toContainEqual(objectNode);
    expect(store.getObjects(objectNode, HYDRA.terms.variable, graph)[0].value).toBe('o');
    const graphNode = store.getSubjects(HYDRA.terms.property, SD.terms.graph, graph)[0];
    expect(mappingNodes).toContainEqual(graphNode);
    expect(store.getObjects(graphNode, HYDRA.terms.variable, graph)[0].value).toBe('g');

    // The data is also there
    expect(store.countQuads('http://example.com/foo', null, null, '')).toBe(2);
  });

  it('returns a large number for the amount of triples and a link to the next page.', async(): Promise<void> => {
    executor = new QpfFilterExecutor(quadPatternExecutor, 1);
    const result = await executor.handle(input);

    expect(result.metadata.contentType).toBe(INTERNAL_QUADS);
    expect(result.metadata.identifier.value).toEqual(input.config.identifier.path);
    const store = await readableToQuads(result.data);

    const graph = store.getSubjects(FOAF.terms.primaryTopic, '', null)[0];
    expect(store.getObjects('', VOID.terms.triples, graph)[0].value).toBe('1000000');
    expect(store.getObjects('', HYDRA.terms.totalItems, graph)[0].value).toBe('1000000');

    const next = store.getObjects(null, HYDRA.terms.next, null);
    expect(next).toHaveLength(1);
  });

  it('returns the data on a second page if there is a large amount of triples.', async(): Promise<void> => {
    executor = new QpfFilterExecutor(quadPatternExecutor, 1);
    (input.config.identifier as QueryResourceIdentifier).query.data = 'true';
    const result = await executor.handle(input);

    expect(result.metadata.contentType).toBe(INTERNAL_QUADS);
    expect(result.metadata.identifier.value).toEqual(input.config.identifier.path);
    const store = await readableToQuads(result.data);

    const graph = store.getSubjects(FOAF.terms.primaryTopic, '', null)[0];
    expect(store.getObjects('', VOID.terms.triples, graph)[0].value).toBe('1000000');
    expect(store.getObjects('', HYDRA.terms.totalItems, graph)[0].value).toBe('1000000');
    expect(store.countQuads(null, null, null, '')).toBe(2);

    const next = store.getObjects(null, HYDRA.terms.next, null);
    expect(next).toHaveLength(0);
  });

  it('always loads all triples for a correct count when the limit is set to 0.', async(): Promise<void> => {
    executor = new QpfFilterExecutor(quadPatternExecutor, 0);
    const result = await executor.handle(input);

    expect(result.metadata.contentType).toBe(INTERNAL_QUADS);
    expect(result.metadata.identifier.value).toEqual(input.config.identifier.path);
    const store = await readableToQuads(result.data);

    const graph = store.getSubjects(FOAF.terms.primaryTopic, '', null)[0];
    expect(store.getObjects('', VOID.terms.triples, graph)[0].value).toBe('2');
    expect(store.getObjects('', HYDRA.terms.totalItems, graph)[0].value).toBe('2');
  });
});
