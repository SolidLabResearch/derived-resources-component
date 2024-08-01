import type { Quad } from '@rdfjs/types';
import { InternalServerError, NotImplementedHttpError, RDF, RepresentationMetadata } from '@solid/community-server';
import type { DerivationConfig } from '../../DerivationConfig';
import { DERIVED_TYPES } from '../../Vocabularies';
import type { Filter } from '../Filter';
import { FilterParser } from './FilterParser';

// TODO:
export class QuadPatternFilterParser extends FilterParser {
  protected readonly cache: WeakMap<DerivationConfig, Partial<Quad>> = new WeakMap();

  public async canHandle(input: DerivationConfig): Promise<void> {
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(input.filter) as Record<string, unknown>;
    } catch {
      throw new NotImplementedHttpError(`Only supports JSON filters`);
    }
    if (!Object.keys(json).every((key): boolean => [ 'subject', 'predicate', 'object', 'graph' ].includes(key))) {
      throw new NotImplementedHttpError('Expected a JSON object with keys subject, predicate, object and/or graph.');
    }

    this.cache.set(input, json);
  }

  public async handle(input: DerivationConfig): Promise<Filter<Partial<Quad>>> {
    const cached = this.cache.get(input);
    if (!cached) {
      throw new InternalServerError('Calling handle before canHandle');
    }
    return {
      data: cached,
      metadata: new RepresentationMetadata({ [RDF.type]: DERIVED_TYPES.terms.QuadPattern }),
    };
  }
}
