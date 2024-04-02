import {
  AccessMap,
  AccessMode,
  IdentifierSetMultiMap,
  InternalServerError,
  PermissionReader,
  ResourceIdentifier
} from '@solid/community-server';
import { CredentialsStorage } from '../credentials/CredentialsStorage';
import { DerivationConfig } from '../DerivationConfig';
import { ParamSetter } from '../init/ParamSetter';
import { DERIVED } from '../Vocabularies';
import { SelectorParser } from './SelectorParser';

/**
 * A {@SelectorParser} that only returns identifiers from its source where the client has read access on.
 * To determine the credentials, a {@link CredentialsStorage} is used.
 * To prevent dependency loop issues when constructing classes,
 * this class is also a {@link ParamSetter} for its {@link PermissionReader} parameter.
 *
 * This removing of identifiers is only done
 * if the {@link DerivationConfig} contains the `derived:ReadableSources` feature.
 */
export class AuthorizedSelectorParser extends SelectorParser implements ParamSetter<PermissionReader> {
  protected readonly source: SelectorParser;
  protected readonly storage: CredentialsStorage;
  protected internalPermissionReader: PermissionReader | undefined;

  public constructor(source: SelectorParser, storage: CredentialsStorage) {
    super();
    this.source = source;
    this.storage = storage;
  }

  public async setParam(permissionReader: PermissionReader): Promise<void> {
    this.internalPermissionReader = permissionReader;
  }

  protected get permissionReader(): PermissionReader {
    if (!this.internalPermissionReader) {
      throw new InternalServerError('Trying to access permission reader before initialization.');
    }
    return this.internalPermissionReader!;
  }

  public async canHandle(config: DerivationConfig): Promise<void> {
    return this.source.canHandle(config);
  }

  public async handle(config: DerivationConfig): Promise<ResourceIdentifier[]> {
    const identifiers = await this.source.handle(config);

    if (!config.metadata.has(DERIVED.terms.feature, DERIVED.terms.ReadableSources)) {
      return identifiers;
    }

    const credentials = await this.storage.get(config.identifier) ?? {};
    const requestedModes: AccessMap = new IdentifierSetMultiMap<AccessMode>();
    for (const identifier of identifiers) {
      requestedModes.set(identifier, AccessMode.read);
    }

    const permissions = await this.permissionReader.handleSafe({ credentials, requestedModes })
    return identifiers.filter((identifier): Boolean => Boolean(permissions.get(identifier)?.read));
  }
}
