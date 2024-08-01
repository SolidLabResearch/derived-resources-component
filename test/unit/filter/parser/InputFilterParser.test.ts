import { RDF, RepresentationMetadata } from '@solid/community-server';
import type { DerivationConfig } from '../../../../src/DerivationConfig';
import { InputFilterParser } from '../../../../src/filter/parser/InputFilterParser';
import { DERIVED_TYPES } from '../../../../src/Vocabularies';

describe('InputFilterParser', (): void => {
  let config: DerivationConfig;
  const parser = new InputFilterParser();

  beforeEach(async(): Promise<void> => {
    config = {
      identifier: { path: 'path' },
      mappings: {},
      selectors: [],
      filter: 'filter string',
      metadata: new RepresentationMetadata(),
    };
  });

  it('returns the filter data input.', async(): Promise<void> => {
    await expect(parser.handle(config)).resolves.toEqual({
      metadata: new RepresentationMetadata({ [RDF.type]: DERIVED_TYPES.terms.String }),
      data: config.filter,
    });
  });
});
