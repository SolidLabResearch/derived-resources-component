import { AsyncHandler, Guarded, Representation } from '@solid/community-server';
import { Store } from 'n3';
import { Readable } from 'node:stream';
import { DerivationConfig } from '../DerivationConfig';

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
export abstract class FilterHandler extends AsyncHandler<FilterHandlerInput, Representation>{}
