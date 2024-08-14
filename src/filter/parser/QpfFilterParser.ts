import { NotImplementedHttpError, RepresentationMetadata } from '@solid/community-server';
import type { DerivationConfig } from '../../DerivationConfig';
import { isQueryResourceIdentifier } from '../../QueryResourceIdentifier';
import { DERIVED_TYPES } from '../../Vocabularies';
import type { Filter } from '../Filter';
import { FilterParser } from './FilterParser';

/**
 * Parses a QPF filter.
 * Since QPF filters are just a string containing 'qpf' the actual data content of the filter object will be empty.
 * The checksum is determined based on the query parameters of the identifier.
 */
export class QpfFilterParser extends FilterParser {
  public async canHandle({ filter }: DerivationConfig): Promise<void> {
    const data = filter.trim();
    if (data !== 'tpf' && data !== 'qpf') {
      throw new NotImplementedHttpError('Only QPF filter bodies are supported.');
    }
  }

  public async handle(config: DerivationConfig): Promise<Filter<string>> {
    return {
      type: DERIVED_TYPES.terms.QPF,
      data: '',
      checksum: isQueryResourceIdentifier(config.identifier) ? JSON.stringify(config.identifier.query) : 'qpf',
      metadata: new RepresentationMetadata(),
    };
  }
}
