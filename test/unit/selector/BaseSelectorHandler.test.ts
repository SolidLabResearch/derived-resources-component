import type { Representation, ResourceIdentifier, ResourceStore } from '@solid/community-server';
import { INTERNAL_QUADS } from '@solid/community-server';
import type { DerivationConfig } from '../../../src/DerivationConfig';
import { BaseSelectorHandler } from '../../../src/selector/BaseSelectorHandler';
import type { SelectorParser } from '../../../src/selector/SelectorParser';

describe('BaseSelectorHandler', (): void => {
  const identifiers: ResourceIdentifier[] = [
    { path: 'http://example.com/foo' },
    { path: 'http://example.com/bar' },
  ];
  const config: DerivationConfig = 'config' as any;
  let store: jest.Mocked<ResourceStore>;
  let parser: jest.Mocked<SelectorParser>;
  let handler: BaseSelectorHandler;

  beforeEach(async(): Promise<void> => {
    store = {
      getRepresentation: jest.fn(async(identifier: ResourceIdentifier): Promise<Representation> =>
        identifier.path as any),
    } satisfies Partial<ResourceStore> as any;

    parser = {
      canHandle: jest.fn(),
      handle: jest.fn().mockResolvedValue(identifiers),
      handleSafe: jest.fn(),
    };

    handler = new BaseSelectorHandler(parser, store);
  });

  it('can handle input its parser can handle.', async(): Promise<void> => {
    await expect(handler.canHandle(config)).resolves.toBeUndefined();
    expect(parser.canHandle).toHaveBeenLastCalledWith(config);

    const error = new Error('bad data');
    parser.canHandle.mockRejectedValue(error);
    await expect(handler.canHandle(config)).rejects.toThrow(error);
  });

  it('returns representations of all identifiers its parser finds.', async(): Promise<void> => {
    await expect(handler.handle(config)).resolves.toEqual([ 'http://example.com/foo', 'http://example.com/bar' ]);
    expect(parser.handle).toHaveBeenLastCalledWith(config);
    expect(store.getRepresentation).toHaveBeenNthCalledWith(1, identifiers[0], { type: { [INTERNAL_QUADS]: 1 }});
    expect(store.getRepresentation).toHaveBeenNthCalledWith(2, identifiers[1], { type: { [INTERNAL_QUADS]: 1 }});
  });
});
