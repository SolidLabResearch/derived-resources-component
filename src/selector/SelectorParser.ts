import { AsyncHandler, ResourceIdentifier } from '@solid/community-server';
import { DerivationConfig } from '../DerivationConfig';

/**
 * Determines which resources should be selected based on the selector info.
 */
export abstract class SelectorParser extends AsyncHandler<DerivationConfig, ResourceIdentifier[]> {}
