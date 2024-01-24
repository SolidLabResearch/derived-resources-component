import { AsyncHandler, ResourceIdentifier } from '@solid/community-server';

export interface SelectorHandlerInput {
  /**
   * Mappings to assign values to variables.
   */
  mappings: Record<string, string>;
  /**
   * The selector value.
   */
  selector: string;
}

/**
 * Determines one or more {@link ResourceIdentifier} based on a selector.
 */
export abstract class SelectorHandler extends AsyncHandler<SelectorHandlerInput, ResourceIdentifier[]> {}
