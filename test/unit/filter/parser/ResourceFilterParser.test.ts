import type { ResourceStore } from '@solid/community-server';
import {
  CONTENT_TYPE,
  guardedStreamFrom,
  RepresentationMetadata,
  SingleRootIdentifierStrategy,
} from '@solid/community-server';
import type { DerivationConfig } from '../../../../src/DerivationConfig';
import type { FilterParser } from '../../../../src/filter/parser/FilterParser';
import { ResourceFilterParser } from '../../../../src/filter/parser/ResourceFilterParser';

describe('ResourceFilterParser', (): void => {
  let config: DerivationConfig;
  const identifierStrategy = new SingleRootIdentifierStrategy('https://example.com/');
  let metadata: RepresentationMetadata;
  let store: jest.Mocked<ResourceStore>;
  let source: jest.Mocked<FilterParser>;
  let parser: ResourceFilterParser;

  beforeEach(async(): Promise<void> => {
    config = {
      identifier: { path: 'https://example.com/foo' },
      mappings: {},
      selectors: [],
      filter: 'filter string',
      metadata: new RepresentationMetadata(),
    };

    store = {
      getRepresentation: jest.fn().mockResolvedValue({
        data: guardedStreamFrom('raw data'),
        metadata: new RepresentationMetadata(),
      }),
    } satisfies Partial<ResourceStore> as any;

    metadata = new RepresentationMetadata({ [CONTENT_TYPE]: 'text/turtle' });
    source = {
      handleSafe: jest.fn().mockResolvedValue({
        data: 'parsed data',
        metadata,
      }),
    } satisfies Partial<FilterParser> as any;

    parser = new ResourceFilterParser(source, store, identifierStrategy);
  });

  it('rejects non-URL filters.', async(): Promise<void> => {
    config.filter = 'not a URL';
    await expect(parser.canHandle(config)).rejects.toThrow('Only valid URLs are supported as filter value.');
  });

  it('rejects out of scope URL filters.', async(): Promise<void> => {
    config.filter = 'http://not.example.com/foo';
    await expect(parser.canHandle(config)).rejects.toThrow('http://not.example.com/foo is not in the scope of the server.');
  });

  it('calls the source filter parser with the contents of the resource.', async(): Promise<void> => {
    await expect(parser.handle(config)).resolves.toEqual({ metadata, data: 'parsed data' });
    expect(source.handleSafe).toHaveBeenCalledTimes(1);
    expect(source.handleSafe).toHaveBeenLastCalledWith({
      ...config,
      filter: 'raw data',
    });
  });
});
