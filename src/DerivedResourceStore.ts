import {
  ChangeMap,
  Conditions,
  getLoggerFor,
  IdentifierStrategy,
  MethodNotAllowedHttpError,
  NotFoundHttpError,
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
  protected readonly logger = getLoggerFor(this);

  protected readonly manager: DerivationManager;
  protected readonly identifierStrategy: IdentifierStrategy;

  public constructor(source: ResourceStore, manager: DerivationManager, identifierStrategy: IdentifierStrategy) {
    super(source);
    this.manager = manager;
    this.identifierStrategy = identifierStrategy;
  }

  public async hasResource(identifier: ResourceIdentifier): Promise<boolean> {
    const exists = await this.source.hasResource(identifier);
    if (exists) {
      return exists;
    }
    return this.isDerivedResource(identifier, true);
  }

  public async getRepresentation(identifier: ResourceIdentifier, preferences: RepresentationPreferences, conditions?: Conditions): Promise<Representation> {
    const firstResource = await this.getFirstExistingResource(identifier);
    this.logger.debug(`${firstResource.metadata.identifier.value} is the first resource that exists starting from ${identifier.path}`);
    const identifierExists = firstResource.metadata.identifier.value === identifier.path;
    const config = await this.manager.getDerivationConfig(identifier, firstResource.metadata);

    if (!config && identifierExists) {
      return firstResource;
    }

    this.closeDataStream(firstResource);

    if (!config) {
      throw new NotFoundHttpError();
    }
    const result = await this.manager.deriveResource(identifier, config);

    // Reuse metadata if the resource had existing metadata
    if (identifierExists) {
      // Removing original content type to prevent duplicates
      firstResource.metadata.contentType = undefined;
      result.metadata.setMetadata(firstResource.metadata);
    }

    return result;
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

  /**
   * Asserts the identifier does not correspond to a derived resource.
   */
  protected async assertNotDerived(identifier: ResourceIdentifier): Promise<void> {
    if (await this.isDerivedResource(identifier)) {
      throw new MethodNotAllowedHttpError([ 'POST', 'PUT', 'PATCH', 'DELETE' ]);
    }
  }

  /**
   * Determines if the identifier corresponds to a derived resource.
   * `skipFirst` parameter will be passed to `getFirstExistingResource` call.
   */
  protected async isDerivedResource(identifier: ResourceIdentifier, skipFirst = false): Promise<boolean> {
    try {
      const parent = await this.getFirstExistingResource(identifier, skipFirst);
      this.closeDataStream(parent);
      this.logger.debug(`${parent.metadata.identifier.value} is the first resource that exists starting from ${identifier.path}`);
      const config = await this.manager.getDerivationConfig(identifier, parent.metadata);

      return Boolean(config);
    } catch (error: unknown) {
      // Depending on the backend, it is possible that the root container does not exist yet, which could throw an error
      if (NotFoundHttpError.isInstance(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Finds the first resource in the container chain that exists, starting from the given identifier.
   * `skipFirst` can be used if you know the input identifier will have no match.
   */
  protected async getFirstExistingResource(identifier: ResourceIdentifier, skipFirst = false): Promise<Representation> {
    try {
      if (skipFirst) {
        throw new NotFoundHttpError();
      }
      // `await` is important here to make sure the error triggers
      return await this.source.getRepresentation(identifier, {});
    } catch(error: unknown) {
      if (NotFoundHttpError.isInstance(error) && !this.identifierStrategy.isRootContainer(identifier)) {
        this.logger.debug(`${identifier.path} does not exist, going up the container chain.`);
        const parent = this.identifierStrategy.getParentContainer(identifier);
        return this.getFirstExistingResource(parent);
      }
      throw error;
    }
  }

  /**
   * Closes the data stream in the representation, without emitting an error.
   */
  protected closeDataStream(representation: Representation): void {
    representation.data.on('error', () => {});
    representation.data.destroy();
  }
}
