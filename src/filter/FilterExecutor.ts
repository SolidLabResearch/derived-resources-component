import { AsyncHandler, Representation } from '@solid/community-server';
import { DerivationConfig } from '../DerivationConfig';
import { Filter } from './Filter';

export interface FilterExecutorInput<T = unknown> {
  /**
   * Config of the derived resource.
   */
  config: DerivationConfig;
  /**
   * Filter object to apply.
   */
  filter: Filter<T>;
  /**
   * Input data for the filter.
   */
  representations: Representation[];
}

/**
 * Applies a {@link Filter} object to a dataset to generate a derived resource representation.
 */
export abstract class FilterExecutor<T = unknown> extends AsyncHandler<FilterExecutorInput<T>, Representation> {}
