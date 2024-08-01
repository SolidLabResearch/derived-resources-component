import { InternalServerError, NotImplementedHttpError, RDF, RepresentationMetadata } from '@solid/community-server';
import type { DerivationConfig } from '../../../../src/DerivationConfig';
import { QuadPatternFilterParser } from '../../../../src/filter/parser/QuadPatternFilterParser';
import { DERIVED_TYPES } from '../../../../src/Vocabularies';

describe('QuadPatternFilterParser', (): void => {
  const filter = {
    predicate: {
      termType: 'NamedNode',
      value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
    },
    object: {
      termType: 'Variable',
      value: 'v',
    },
  };
  let config: DerivationConfig;
  let parser: QuadPatternFilterParser;

  beforeEach(async(): Promise<void> => {
    config = {
      filter: JSON.stringify(filter),
      identifier: { path: 'http://example.com' },
      mappings: {},
      selectors: [],
      metadata: new RepresentationMetadata(),
    };

    parser = new QuadPatternFilterParser();
  });

  it('rejects non-JSON filters.', async(): Promise<void> => {
    config.filter = 'hello';
    await expect(parser.canHandle(config)).rejects.toThrow(NotImplementedHttpError);
  });

  it('rejects non-quad filters.', async(): Promise<void> => {
    config.filter = '{ "wrong": "field" }';
    await expect(parser.canHandle(config)).rejects.toThrow(NotImplementedHttpError);
  });

  it('rejects handle requests without a preceding canHandle.', async(): Promise<void> => {
    await expect(parser.handle(config)).rejects.toThrow(InternalServerError);
  });

  it('returns a quad pattern filter.', async(): Promise<void> => {
    await expect(parser.canHandle(config)).resolves.toBeUndefined();
    const result = await parser.handle(config);
    expect(result.data).toEqual(filter);
    expect(result.metadata.get(RDF.terms.type)?.value).toEqual(DERIVED_TYPES.QuadPattern);
  });
});
