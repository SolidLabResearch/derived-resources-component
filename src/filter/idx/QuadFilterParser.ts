import { Quad } from '@rdfjs/types';
import { AsyncHandler, Guarded, Representation } from '@solid/community-server';
import { Readable } from 'node:stream';

export interface QuadFilterParserArgs {
  filter: Partial<Quad>;
  representation: Representation;
}

/**
 * Applies a quad filter to a given representation to return a quad stream of all triples matching the filter.
 */
export abstract class QuadFilterParser extends AsyncHandler<QuadFilterParserArgs, Guarded<Readable>> {}
