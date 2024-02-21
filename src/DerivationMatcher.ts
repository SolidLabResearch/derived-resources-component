import { Term } from '@rdfjs/types';
import { AsyncHandler, RepresentationMetadata, ResourceIdentifier } from '@solid/community-server';

export interface DerivationMatcherInput {
  subject: Term;
  identifier: ResourceIdentifier;
  metadata: RepresentationMetadata;
}

export interface DerivationConfig {
  mappings: Record<string, string>;
  selectors: string[];
  filter: string;
}

export abstract class DerivationMatcher extends AsyncHandler<DerivationMatcherInput, DerivationConfig> {}
