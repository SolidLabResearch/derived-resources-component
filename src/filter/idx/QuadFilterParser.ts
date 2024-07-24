import type { Readable } from 'node:stream';
import type { Quad } from '@rdfjs/types';
import type { Guarded, Representation } from '@solid/community-server';
import { AsyncHandler } from '@solid/community-server';

export interface QuadFilterParserArgs {
  filter: Partial<Quad>;
  representation: Representation;
}

/**
 * Applies a quad filter to a given representation to return a quad stream of all triples matching the filter.
 */
export abstract class QuadFilterParser extends AsyncHandler<QuadFilterParserArgs, Guarded<Readable>> {}
