import { Conditions, Representation, ResourceIdentifier } from '@solid/community-server';

/**
 * Responsible for handling derived resources.
 */
export interface DerivationManager {
  /**
   * Determines if the given resource is a derived resource.
   *
   * @param identifier - Identifier of the resource.
   */
  isDerivedResource(identifier: ResourceIdentifier): Promise<boolean>;

  /**
   * Returns the representation associated with this identifier.
   * For standard resources this is just the stored representation,
   * while for derived resources this will need to be generated.
   *
   * @param identifier - Identifier of the resource.
   * @param conditions - Conditions of the request.
   */
  handleResource(identifier: ResourceIdentifier, conditions?: Conditions): Promise<Representation>;
}
