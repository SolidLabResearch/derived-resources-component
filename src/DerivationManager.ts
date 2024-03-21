import { Representation, RepresentationMetadata, ResourceIdentifier } from '@solid/community-server';
import { DerivationConfig } from './DerivationConfig';

/**
 * Responsible for handling derived resources.
 */
export interface DerivationManager {
  /**
   * Determines the {@link DerivationConfig} for the given identifier,
   * by looking in the provided metadata.
   *
   * @param identifier - Identifier to find the config for.
   * @param metadata - Metadata to look in.
   *
   * @returns The applicable configuration. `undefined` if this resource is not to be derived.
   */
  getDerivationConfig(identifier: ResourceIdentifier, metadata: RepresentationMetadata): Promise<DerivationConfig | undefined>;

  /**
   * Derives a resource based on the information provided in the {@link DerivationConfig}.
   *
   * @param identifier - Identifier to derive the representation for.
   * @param config - Config to use to derive the representation.
   */
  deriveResource(identifier: ResourceIdentifier, config: DerivationConfig): Promise<Representation>;
}

