import { Conditions, Representation, ResourceIdentifier } from '@solid/community-server';

// TODO:
export interface DerivationManager {
  isDerivedResource(identifier: ResourceIdentifier): Promise<boolean>;
  handleResource(identifier: ResourceIdentifier, conditions?: Conditions): Promise<Representation>;
}
