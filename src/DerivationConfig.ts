import type { RepresentationMetadata, ResourceIdentifier } from '@solid/community-server';

/**
 * Describes all the necessary information to derive a resource.
 */
export interface DerivationConfig {
  /**
   * The identifier of the resource being derived.
   */
  identifier: ResourceIdentifier;
  /**
   * Any input mappings that need to be applied.
   */
  mappings: Record<string, string>;
  /**
   * The selectors determining the input data.
   */
  selectors: string[];
  /**
   * The filter to apply on the input data.
   */
  filter: string;
  /**
   * Contains all metadata that is relevant in defining this derived resource.
   */
  metadata: RepresentationMetadata;
}
