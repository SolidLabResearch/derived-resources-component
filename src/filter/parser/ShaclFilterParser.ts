import { NotImplementedHttpError, RDF } from '@solid/community-server';
import type { Store } from 'n3';
import type { DerivationConfig } from '../../DerivationConfig';
import { DERIVED_TYPES, SH } from '../../Vocabularies';
import type { Filter } from '../Filter';
import { QuadFilterParser } from './QuadFilterParser';

// TODO:
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
    filter.metadata.add(RDF.terms.type, DERIVED_TYPES.terms.Shacl);
    return filter;
  }
}
