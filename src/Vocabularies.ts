import { createVocabulary } from '@solid/community-server';

export const DERIVED = createVocabulary('urn:npm:solid:derived-resources:',
  // Used to link to a single derived resource instance
  'derivedResource',

  'template',
  'selector',
  'filter',
);
