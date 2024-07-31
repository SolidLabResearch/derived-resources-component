import { RepresentationMetadata } from '@solid/community-server';
import type { DerivationConfig } from '../../../src/DerivationConfig';
import type { Filter } from '../../../src/filter/Filter';
import type { FilterParser } from '../../../src/filter/FilterParser';
import { MappingFilterParser } from '../../../src/filter/MappingFilterParser';

describe('MappingFilterParser', (): void => {
  const filter: Filter<string> = {
    data: 'filter',
    metadata: new RepresentationMetadata(),
  };
  let config: DerivationConfig;
  let source: jest.Mocked<FilterParser>;
  let parser: MappingFilterParser;

  beforeEach(async(): Promise<void> => {
    config = {
      identifier: { path: 'https://example.com' },
      mappings: { var: 'value', other: 'unused' },
      selectors: [ 'selector' ],
      filter: 'string with $var$ in it',
      metadata: new RepresentationMetadata(),
    };

    source = {
      handleSafe: jest.fn().mockResolvedValue(filter),
    } satisfies Partial<FilterParser> as any;

    parser = new MappingFilterParser(source);
  });

  it('applies mappings to the filter.', async(): Promise<void> => {
    await expect(parser.handle(config)).resolves.toBe(filter);
    expect(source.handleSafe).toHaveBeenLastCalledWith({
      ...config,
      filter: 'string with value in it',
    });
  });
});
