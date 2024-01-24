import {
  ChangeMap,
  Conditions,
  MethodNotAllowedHttpError,
  PassthroughStore,
  Patch,
  Representation,
  RepresentationPreferences,
  ResourceIdentifier,
  ResourceStore
} from '@solid/community-server';
import { DerivationManager } from './DerivationManager';

/**
 * A {@link ResourceStore} which adds support for derived resources using a {@link DerivationManager}.
 * Assumes preferences will be handled by a previous store in the chain.
 * Prevents writing to a resource if it is a derived resource.
 */
export class DerivedResourceStore extends PassthroughStore {
  protected readonly manager: DerivationManager;

  public constructor(source: ResourceStore, manager: DerivationManager) {
    super(source);
    this.manager = manager;
  }

  public async hasResource(identifier: ResourceIdentifier): Promise<boolean> {
    const exists = this.source.hasResource(identifier);
    if (exists) {
      return exists;
    }
    return this.manager.isDerivedResource(identifier);
  }

  public async getRepresentation(identifier: ResourceIdentifier, preferences: RepresentationPreferences, conditions?: Conditions): Promise<Representation> {
    return this.manager.handleResource(identifier, conditions);
  }

  public async addResource(container: ResourceIdentifier, representation: Representation, conditions?: Conditions): Promise<ChangeMap> {
    await this.assertNotDerived(container);
    return this.source.addResource(container, representation, conditions);
  }

  public async setRepresentation(identifier: ResourceIdentifier, representation: Representation, conditions?: Conditions): Promise<ChangeMap> {
    await this.assertNotDerived(identifier);
    return this.source.setRepresentation(identifier, representation, conditions);
  }

  public async modifyResource(identifier: ResourceIdentifier, patch: Patch, conditions?: Conditions): Promise<ChangeMap> {
    await this.assertNotDerived(identifier);
    return this.source.modifyResource(identifier, patch, conditions);
  }

  public async deleteResource(identifier: ResourceIdentifier, conditions?: Conditions): Promise<ChangeMap> {
    await this.assertNotDerived(identifier);
    return this.source.deleteResource(identifier, conditions);
  }

  protected async assertNotDerived(identifier: ResourceIdentifier): Promise<void> {
    if (await this.manager.isDerivedResource(identifier)) {
      throw new MethodNotAllowedHttpError([ 'POST', 'PUT', 'PATCH', 'DELETE' ]);
    }
  }
}
