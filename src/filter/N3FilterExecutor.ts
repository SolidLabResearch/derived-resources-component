import { AsyncHandler, Representation } from '@solid/community-server';
import { Store } from 'n3';
import { DerivationConfig } from '../DerivationConfig';
import { Filter } from './Filter';

export interface N3FilterExecutorInput<T = unknown> {
  /**
   * Config of the derived resource.
   */
  config: DerivationConfig;
  /**
   * Filter object to apply.
   */
  filter: Filter<T>;
  /**
   * N3.js store containing the triples to apply the filter to.
   */
  data: Store;
}

/**
 * Similar to a {@link FilterExecutor} but takes an N3.js store as input instead.
 */
export abstract class N3FilterExecutor extends AsyncHandler<N3FilterExecutorInput, Representation> {}
