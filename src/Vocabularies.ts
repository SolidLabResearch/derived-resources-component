import { createVocabulary } from '@solid/community-server';

export const DERIVED = createVocabulary(
  'urn:npm:solid:derived-resources:',
  // Used to link to a single derived resource instance
  'derivedResource',
  'template',
  'selector',
  'filter',
  'feature',

  // A feature used to indicate that only sources for which the requesting agent has read access should be used
  'ReadableSources',
);

export const DERIVED_INDEX = createVocabulary(
  'urn:npm:solid:derived-index:',
  'for',
  'instance',
);

export const SH = createVocabulary(
  'http://www.w3.org/ns/shacl#',
  'property',
  'path',
  'node',

  // Validation report
  'focusNode',

  // Focus node
  'targetNode',
  'targetClass',
  'targetSubjectsOf',
  'targetObjectsOf',
);
