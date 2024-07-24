import type { Term } from '@rdfjs/types';
import type { RepresentationMetadata, ResourceIdentifier } from '@solid/community-server';
import { AsyncHandler } from '@solid/community-server';
import type { DerivationConfig } from '../DerivationConfig';

export interface DerivationMatcherInput {
  /**
   * The subject that should be used to find derivation triples in the metadata.
   */
  subject: Term;
  /**
   * Identifier of the resource being derived.
   */
  identifier: ResourceIdentifier;
  /**
   * Metadata in which to find the config triples.
   */
  metadata: RepresentationMetadata;
}

/**
 * Extract a matching config from metadata, if one can be found.
 */
export abstract class DerivationMatcher extends AsyncHandler<DerivationMatcherInput, DerivationConfig> {}
