import { RepresentationMetadata } from '@solid/community-server';

/**
 * The result of parsing filter metadata.
 */
export interface Filter<T = unknown> {
  data: T;
  metadata: RepresentationMetadata;
}
