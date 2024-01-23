import { AsyncHandler, ResourceIdentifier } from '@solid/community-server';

export interface SelectorHandlerInput {
  mappings: Record<string, string>;
  selector: string;
}

export abstract class SelectorHandler extends AsyncHandler<SelectorHandlerInput, ResourceIdentifier[]> {}
