import { AsyncHandler } from '@solid/community-server';
import { DerivationConfig } from '../DerivationConfig';
import { Filter } from './Filter';

/**
 * Interprets raw filter input into a {@link Filter} object.
 */
export abstract class FilterParser extends AsyncHandler<DerivationConfig, Filter> {}
