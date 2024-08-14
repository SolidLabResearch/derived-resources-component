import { NotImplementedHttpError, RepresentationMetadata } from '@solid/community-server';
import type { DerivationConfig } from '../../../../src/DerivationConfig';
import { QpfFilterParser } from '../../../../src/filter/parser/QpfFilterParser';
import type { QueryResourceIdentifier } from '../../../../src/QueryResourceIdentifier';
import { DERIVED_TYPES } from '../../../../src/Vocabularies';

describe('QpfFilterParser', (): void => {
  let config: DerivationConfig;
  const parser = new QpfFilterParser();

  beforeEach(async(): Promise<void> => {
    config = {
      identifier: { path: 'http://example.com/', query: { a: 'b', c: 'd' }} as QueryResourceIdentifier,
      filter: 'qpf',
      mappings: {},
      selectors: [],
      metadata: new RepresentationMetadata(),
    };
  });

  it('only accepts qpf/tpf filters.', async(): Promise<void> => {
    await expect(parser.canHandle(config)).resolves.toBeUndefined();

    config.filter = 'tpf';
    await expect(parser.canHandle(config)).resolves.toBeUndefined();

    config.filter = 'jpf';
    await expect(parser.canHandle(config)).rejects.toThrow(NotImplementedHttpError);
  });

  it('returns a QPF filter object.', async(): Promise<void> => {
    await expect(parser.handle(config)).resolves.toEqual({
      type: DERIVED_TYPES.terms.QPF,
      data: '',
      checksum: '{"a":"b","c":"d"}',
      metadata: new RepresentationMetadata(),
    });
  });
});
