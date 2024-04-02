import { Authorizer, AuthorizerInput } from '@solid/community-server';
import { CredentialsStorage } from './CredentialsStorage';

/**
 * An {@link Authorizer} that stores the credentials in a {@link CredentialsStorage}.
 * Does nothing else, so you probably also want a different {@link Authorizer} for actual authorization.
 */
export class StoreCredentialsAuthorizer extends Authorizer {
  protected readonly storage: CredentialsStorage;

  public constructor(storage: CredentialsStorage) {
    super();
    this.storage = storage;
  }

  public async handle(input: AuthorizerInput): Promise<void> {
    const requested = new Set(input.requestedModes.keys());
    for (const identifier of requested) {
      await this.storage.set(identifier, input.credentials);
    }
  }
}
