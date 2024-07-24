import type { ResourceIdentifier } from '@solid/community-server';
import { AsyncHandler } from '@solid/community-server';
import type { DerivationConfig } from '../DerivationConfig';

/**
 * Determines which resources should be selected based on the selector info.
 */
export abstract class SelectorParser extends AsyncHandler<DerivationConfig, ResourceIdentifier[]> {}
