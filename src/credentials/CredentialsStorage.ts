import { Credentials, KeyValueStorage, ResourceIdentifier } from '@solid/community-server';

/**
 * A storage that links a {@link ResourceIdentifier} to {@link Credentials}.
 * Can be used to keep track of the credentials during a request.
 */
export type CredentialsStorage = KeyValueStorage<ResourceIdentifier, Credentials>;
