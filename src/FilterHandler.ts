import { AsyncHandler, Guarded } from '@solid/community-server';
import { Store } from 'n3';
import { Readable } from 'node:stream';

export interface FilterManagerInput {
  mappings: Record<string, string>;
  filter: string;
  data: Store;
}

export abstract class FilterHandler extends AsyncHandler<FilterManagerInput, Guarded<Readable>>{}
