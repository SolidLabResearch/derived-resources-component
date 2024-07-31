import { InternalServerError, NotImplementedHttpError, RepresentationMetadata } from '@solid/community-server';
import type { DerivationConfig } from '../../../../src/DerivationConfig';
import { QuadFilterParser } from '../../../../src/filter/parser/QuadFilterParser';

describe('QuadFilterParser', (): void => {
  let config: DerivationConfig;
  const parser = new QuadFilterParser();

  beforeEach(async(): Promise<void> => {
    config = {
      identifier: { path: 'path' },
      filter: '<a> <b> <c>.',
      mappings: {},
      selectors: [],
      metadata: new RepresentationMetadata(),
    };
  });

  it('parses the filter into quads.', async(): Promise<void> => {
    const filter = await parser.handleSafe(config);
    expect('getQuads' in filter.data).toBe(true);
    expect(filter.data.size).toBe(1);
  });

  it('errors for non-turtle input.', async(): Promise<void> => {
    config.filter = 'not turtle';
    await expect(parser.canHandle(config)).rejects.toThrow(NotImplementedHttpError);
  });

  it('errors calling handle before canHandle.', async(): Promise<void> => {
    await expect(parser.handle(config)).rejects.toThrow(InternalServerError);
  });
});
