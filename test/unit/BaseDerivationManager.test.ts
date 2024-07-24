import type {
  Representation,
} from '@solid/community-server';
import {
  BasicRepresentation,
  NotImplementedHttpError,
  RepresentationMetadata,
} from '@solid/community-server';
import { DataFactory } from 'n3';
import { BaseDerivationManager } from '../../src/BaseDerivationManager';
import type { DerivationMatcher } from '../../src/config/DerivationMatcher';
import type { DerivationConfig } from '../../src/DerivationConfig';
import type { FilterHandler } from '../../src/filter/FilterHandler';
import type { SelectorHandler } from '../../src/selector/SelectorHandler';
import { DERIVED } from '../../src/Vocabularies';
import namedNode = DataFactory.namedNode;

describe('BaseDerivationManager', (): void => {
  let config: DerivationConfig;
  const identifier = { path: 'https://example.com/foo' };
  const selector = 'https://example.com/selector';
  const filter = 'https://example.com/filter';
  let metadata: RepresentationMetadata;
  let representation: Representation;
  const subject = namedNode('urn:derived:subject');

  let derivationMatcher: jest.Mocked<DerivationMatcher>;
  let selectorHandler: jest.Mocked<SelectorHandler>;
  let filterHandler: jest.Mocked<FilterHandler>;
  let manager: BaseDerivationManager;

  beforeEach(async(): Promise<void> => {
    config = {
      identifier,
      mappings: {},
      selectors: [ selector ],
      filter,
      metadata: new RepresentationMetadata(),
    };

    metadata = new RepresentationMetadata();
    metadata.add(DERIVED.terms.derivedResource, subject);

    representation = new BasicRepresentation('derived', 'text/plain');

    derivationMatcher = {
      handleSafe: jest.fn().mockResolvedValue(config),
    } satisfies Partial<DerivationMatcher> as any;

    selectorHandler = {
      handleSafe: jest.fn().mockResolvedValue([ new BasicRepresentation() ]),
    } satisfies Partial<SelectorHandler> as any;

    filterHandler = {
      handleSafe: jest.fn().mockResolvedValue(representation),
    } satisfies Partial<FilterHandler> as any;

    manager = new BaseDerivationManager({
      derivationMatcher,
      selectorHandler,
      filterHandler,
    });
  });

  it('returns the matching result from the matcher.', async(): Promise<void> => {
    await expect(manager.getDerivationConfig(identifier, metadata)).resolves.toBe(config);
    expect(derivationMatcher.handleSafe).toHaveBeenLastCalledWith({ identifier, metadata, subject });
  });

  it('returns no config if there is no match.', async(): Promise<void> => {
    derivationMatcher.handleSafe.mockRejectedValueOnce(new NotImplementedHttpError());
    await expect(manager.getDerivationConfig(identifier, metadata)).resolves.toBeUndefined();
  });

  it('returns the derived resource.', async(): Promise<void> => {
    await expect(manager.deriveResource(identifier, config)).resolves.toBe(representation);
  });
});
