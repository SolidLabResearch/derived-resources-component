import type {
  AccessMap,
  Credentials,
  PermissionReader,
  PermissionSet,
  ResourceIdentifier,
} from '@solid/community-server';
import {
  AccessMode,
  IdentifierMap,
  IdentifierSetMultiMap,
  InternalServerError
  ,
  RepresentationMetadata,
} from '@solid/community-server';
import type { CredentialsStorage } from '../../../src/credentials/CredentialsStorage';
import type { DerivationConfig } from '../../../src/DerivationConfig';
import { AuthorizedSelectorParser } from '../../../src/selector/AuthorizedSelectorParser';
import type { SelectorParser } from '../../../src/selector/SelectorParser';
import { DERIVED } from '../../../src/Vocabularies';

describe('AuthorizedSelectorParser', (): void => {
  let config: DerivationConfig;
  const credentials: Credentials = { agent: { webId: 'WebID' }};
  const identifiers: ResourceIdentifier[] = [
    { path: 'http://example.com/public' },
    { path: 'http://example.com/restricted' },
  ];
  let source: jest.Mocked<SelectorParser>;
  let storage: jest.Mocked<CredentialsStorage>;
  let permissionReader: jest.Mocked<PermissionReader>;
  let parser: AuthorizedSelectorParser;

  beforeEach(async(): Promise<void> => {
    config = {
      identifier: { path: 'http://example.com/derived' },
      mappings: {},
      selectors: [],
      filter: 'filter',
      metadata: new RepresentationMetadata(),
    };

    source = {
      canHandle: jest.fn(),
      handle: jest.fn().mockResolvedValue(identifiers),
      handleSafe: jest.fn(),
    };

    storage = {
      get: jest.fn().mockResolvedValue(credentials),
    } satisfies Partial<CredentialsStorage> as any;

    permissionReader = {
      handleSafe: jest.fn().mockResolvedValue(new IdentifierMap<PermissionSet>([[{ path: 'http://example.com/public' }, { [AccessMode.read]: true }]])),
    } satisfies Partial<PermissionReader> as any;

    parser = new AuthorizedSelectorParser(source, storage);
  });

  it('can handle input its source can handle.', async(): Promise<void> => {
    await expect(parser.canHandle(config)).resolves.toBeUndefined();

    const error = new Error('bad data');
    source.canHandle.mockRejectedValueOnce(error);
    await expect(parser.canHandle(config)).rejects.toThrow(error);
  });

  it('returns the source identifiers if the ReadableSource feature is not enabled.', async(): Promise<void> => {
    await expect(parser.handle(config)).resolves.toEqual(identifiers);
  });

  it('errors handling data if the PermissionReader has not been set yet.', async(): Promise<void> => {
    config.metadata.add(DERIVED.terms.feature, DERIVED.terms.ReadableSources);
    await expect(parser.handle(config)).rejects.toThrow(InternalServerError);
  });

  it('only returns the readable sources if the feature is enabled.', async(): Promise<void> => {
    config.metadata.add(DERIVED.terms.feature, DERIVED.terms.ReadableSources);
    await parser.setParam(permissionReader);
    await expect(parser.handle(config)).resolves.toEqual([{ path: 'http://example.com/public' }]);
    const requestedModes: AccessMap = new IdentifierSetMultiMap<AccessMode>(
      [[ identifiers[0], AccessMode.read ], [ identifiers[1], AccessMode.read ]],
    );
    expect(permissionReader.handleSafe).toHaveBeenLastCalledWith({ credentials, requestedModes });
  });
});
