import { createVocabulary, extendVocabulary, FOAF as FOAF_CSS, RDF as RDF_CSS } from '@solid/community-server';

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

export const DERIVED_TYPES = createVocabulary(
  'urn:npm:solid:derived-resources:types:',
  'QPF',
  'QuadPattern',
  'Shacl',
  'Sparql',
  'Store',
  'String',
);

export const DERIVED_INDEX = createVocabulary(
  'urn:npm:solid:derived-index:',
  'for',
  'instance',
);

export const HYDRA = createVocabulary(
  'http://www.w3.org/ns/hydra/core#',
  'first',
  'mapping',
  'next',
  'property',
  'search',
  'template',
  'totalItems',
  'variable',
  'view',
);

export const SD = createVocabulary(
  'http://www.w3.org/ns/sparql-service-description#',
  'defaultGraph',
  'graph',
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

export const VOID = createVocabulary(
  'http://rdfs.org/ns/void#',
  'triples',
  'subset',
);

export const FOAF = extendVocabulary(
  FOAF_CSS,
  'primaryTopic',
);

export const RDF = extendVocabulary(
  RDF_CSS,
  'subject',
  'predicate',
  'object',
);
