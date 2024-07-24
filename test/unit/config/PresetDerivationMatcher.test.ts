import { NotImplementedHttpError, RepresentationMetadata } from '@solid/community-server';
import { DataFactory } from 'n3';
import type { DerivationMatcher, DerivationMatcherInput } from '../../../src/config/DerivationMatcher';
import { PresetDerivationMatcher } from '../../../src/config/PresetDerivationMatcher';
import namedNode = DataFactory.namedNode;

describe('PresetDerivationMatcher', (): void => {
  const input: DerivationMatcherInput = {
    subject: namedNode('subject'),
    identifier: { path: 'https://example.com/foo' },
    metadata: new RepresentationMetadata({ path: 'https://example.com/' }),
  };
  let source: jest.Mocked<DerivationMatcher>;
  let manager: PresetDerivationMatcher;

  beforeEach(async(): Promise<void> => {
    source = {
      canHandle: jest.fn(),
      handle: jest.fn().mockResolvedValue({
        mappings: { map: 'ping' },
        selectors: [ 'source' ],
        filter: 'source',
      }),
    } satisfies Partial<DerivationMatcher> as any;

    manager = new PresetDerivationMatcher(source);
  });

  it('can handle input the source can handle.', async(): Promise<void> => {
    await expect(manager.canHandle(input)).resolves.toBeUndefined();
    source.canHandle.mockRejectedValueOnce(new NotImplementedHttpError());
    await expect(manager.canHandle(input)).rejects.toThrow(NotImplementedHttpError);
  });

  it('adds the necessary preset mappings.', async(): Promise<void> => {
    await expect(manager.handle(input)).resolves.toEqual({
      mappings: {
        map: 'ping',
        source: 'https://example.com/',
        identifier: 'https://example.com/foo',
      },
      selectors: [ 'source' ],
      filter: 'source',
    });
  });
});
