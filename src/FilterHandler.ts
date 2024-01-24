import { AsyncHandler, Guarded } from '@solid/community-server';
import { Store } from 'n3';
import { Readable } from 'node:stream';

export interface FilterManagerInput {
  /**
   * Mappings to assign values to variables.
   */
  mappings: Record<string, string>;
  /**
   * The filter value.
   */
  filter: string;
  /**
   * The store containing all the selected data to filter.
   */
  data: Store;
}

/**
 * Applies a filter to a dataset.
 */
export abstract class FilterHandler extends AsyncHandler<FilterManagerInput, Guarded<Readable>>{}
