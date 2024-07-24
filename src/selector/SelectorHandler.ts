import type { Representation } from '@solid/community-server';
import { AsyncHandler } from '@solid/community-server';
import type { DerivationConfig } from '../DerivationConfig';

/**
 * Acquires one or more {@link Representation}s based on a {@link DerivationConfig}.
 */
export abstract class SelectorHandler extends AsyncHandler<DerivationConfig, Representation[]> {}
