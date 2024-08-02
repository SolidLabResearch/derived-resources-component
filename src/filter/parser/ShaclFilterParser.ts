import { NotImplementedHttpError } from '@solid/community-server';
import type { Store } from 'n3';
import type { DerivationConfig } from '../../DerivationConfig';
import { DERIVED_TYPES, SH } from '../../Vocabularies';
import type { Filter } from '../Filter';
import { QuadFilterParser } from './QuadFilterParser';

/**
 * Interprets a filter with text/turtle data as a SHACL document.
 */
export class ShaclFilterParser extends QuadFilterParser {
  public async canHandle(input: DerivationConfig): Promise<void> {
    await super.canHandle(input);
    const cached = this.cache.get(input)!;
    if (cached.countQuads(null, SH.terms.property, null, null) === 0) {
      throw new NotImplementedHttpError('Expected at least one sh:property predicate in a SHACL resource');
    }
  }

  public async handle(input: DerivationConfig): Promise<Filter<Store>> {
    const filter = await super.handle(input);
    filter.type = DERIVED_TYPES.terms.Shacl;
    return filter;
  }
}
