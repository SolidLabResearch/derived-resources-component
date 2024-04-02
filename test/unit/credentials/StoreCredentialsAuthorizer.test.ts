import { AccessMap, AccessMode, Credentials, PermissionMap } from '@solid/community-server';
import { IdentifierSetMultiMap } from '@solid/community-server/dist/util/map/IdentifierMap';
import { CredentialsStorage } from '../../../src/credentials/CredentialsStorage';
import { StoreCredentialsAuthorizer } from '../../../src/credentials/StoreCredentialsAuthorizer';

describe('StoreCredentialsAuthorizer', (): void => {
  const credentials: Credentials = { agent: { webId: 'http://example.com/alice' }};
  const requestedModes: AccessMap = new IdentifierSetMultiMap<AccessMode>([
    [ { path: 'http://example.com/foo' }, AccessMode.read ],
    [ { path: 'http://example.com/bar' }, AccessMode.read ],
  ]);
  const availablePermissions: PermissionMap = 'permissions' as any;
  let storage: jest.Mocked<CredentialsStorage>;
  let authorizer: StoreCredentialsAuthorizer;

  beforeEach(async(): Promise<void> => {
    storage = {
      set: jest.fn()
    } satisfies Partial<CredentialsStorage> as any;

    authorizer = new StoreCredentialsAuthorizer(storage);
  });

  it('stores the credentials.', async(): Promise<void> => {
    await expect(authorizer.handle({ credentials, requestedModes, availablePermissions })).resolves.toBeUndefined();
    expect(storage.set).toHaveBeenNthCalledWith(1, { path: 'http://example.com/foo' }, credentials);
    expect(storage.set).toHaveBeenNthCalledWith(2, { path: 'http://example.com/bar' }, credentials);
  });
});
