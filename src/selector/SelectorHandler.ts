import { AsyncHandler, Representation } from '@solid/community-server';
import { DerivationConfig } from '../DerivationConfig';

/**
 * Acquires one or more {@link Representation}s based on a {@link DerivationConfig}.
 */
export abstract class SelectorHandler extends AsyncHandler<DerivationConfig, Representation[]> {}
