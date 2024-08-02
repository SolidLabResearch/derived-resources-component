import { NotImplementedHttpError, RepresentationMetadata } from '@solid/community-server';
import type { DerivationConfig } from '../../../../src/DerivationConfig';
import type { Filter } from '../../../../src/filter/Filter';
import { SparqlFilterParser } from '../../../../src/filter/parser/SparqlFilterParser';
import { DERIVED_TYPES } from '../../../../src/Vocabularies';

describe('SparqlFilterParser', (): void => {
  let config: DerivationConfig;
  const parser = new SparqlFilterParser();

  beforeEach(async(): Promise<void> => {
    config = {
      filter: 'SELECT * WHERE { ?s ?p ?o }',
      metadata: new RepresentationMetadata(),
      identifier: { path: 'http://example.com' },
      mappings: {},
      selectors: [],
    };
  });

  it('rejects non-SPARQL filters.', async(): Promise<void> => {
    await expect(parser.canHandle(config)).resolves.toBeUndefined();

    config.filter = 'not a sparql query';
    await expect(parser.canHandle(config)).rejects.toThrow(NotImplementedHttpError);
  });

  it('returns the SPARQL query.', async(): Promise<void> => {
    await expect(parser.handle(config)).resolves.toEqual({
      data: 'SELECT * WHERE { ?s ?p ?o }',
      type: DERIVED_TYPES.terms.Sparql,
      checksum: 'SELECT * WHERE { ?s ?p ?o }',
      metadata: new RepresentationMetadata(),
    } satisfies Filter<string>);
  });
});
