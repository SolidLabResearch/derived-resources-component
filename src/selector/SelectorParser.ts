import { AsyncHandler, ResourceIdentifier } from '@solid/community-server';

export interface SelectorParserInput {
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
 * Determines which resources should be selected based on the selector info.
 */
export abstract class SelectorParser extends AsyncHandler<SelectorParserInput, ResourceIdentifier[]> {}
