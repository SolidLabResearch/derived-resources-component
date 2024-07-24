import type { Representation } from '@solid/community-server';
import { AsyncHandler } from '@solid/community-server';
import type { DerivationConfig } from '../DerivationConfig';

export interface FilterHandlerInput {
  /**
   * The config used to determine the derivation.
   */
  config: DerivationConfig;
  /**
   * The input sources to filter.
   */
  representations: Representation[];
}

/**
 * Applies a filter to a dataset to generate a derived resource representation.
 */
export abstract class FilterHandler extends AsyncHandler<FilterHandlerInput, Representation> {}
