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

// TODO: FORMAT
//       <> :templatedResource [].
//       [] :uriTemplate "test/{name}" -> relative to container it appears in, string since not valid URI due to template stuff
//          :filter <> -> link to actual resource containing the filter, could potentially also allow query itself there as string?
//          :selector <>, <> -> could support multiple resources like this, could also link to document containing the sources?
//                                                                          could also use templates here, but would have to be strings then as well

// TODO: logging

// TODO: can't have specific permissions on derived resources if the actual document does not exist?
//       or can we... since they do exist, would just have to be careful with parent containers also being derived?
//       ^ this might ruin things up when checking existence and derived metadata on parent container so have to be careful
//       !! seems like this is already possible anyway?

// TODO: might want to put this more in front so PATCH can't even start on this

export class DerivedResourceStore extends PassthroughStore {
  protected readonly manager: DerivationManager;
  // TODO: used to reuse representation we find in hasResource
  //       cache could be in manager if the calls are done there
  // protected readonly cache: WeakMap<ResourceIdentifier, RepresentationMetadata>;

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
