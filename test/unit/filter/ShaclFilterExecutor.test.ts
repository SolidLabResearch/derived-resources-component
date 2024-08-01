import {
  INTERNAL_QUADS,
  RDF,
  readableToQuads,
  RepresentationMetadata,
} from '@solid/community-server';
import { Parser, Store } from 'n3';
import type { N3FilterExecutorInput } from '../../../src/filter/N3FilterExecutor';
import { ShaclFilterExecutor } from '../../../src/filter/ShaclFilterExecutor';
import { DERIVED_TYPES } from '../../../src/Vocabularies';

describe('ShaclFilterExecutor', (): void => {
  const turtle = `
    @prefix ex: <http://example.com/ns#>.
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
    @prefix sh: <http://www.w3.org/ns/shacl#>.
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
  
    ex:Alice
      a ex:Person ;
      ex:address [ ex:postalCode "1234" ] ;
      ex:worksFor ex:AliceCompany .
      
    ex:Bob
      a ex:Person ;
      ex:address [ ex:postalCode "1234" ], [ ex:postalCode "5678" ].
      
    ex:Calvin
      a ex:Person ;
      ex:birthDate "1971-07-07"^^xsd:date ;
      ex:worksFor ex:UntypedCompany .
  `;
  const shacl = `
    @prefix ex: <http://example.com/ns#>.
    @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.
    @prefix sh: <http://www.w3.org/ns/shacl#>.
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
  
    ex:PersonShape
      a sh:NodeShape ;
      sh:targetClass ex:Person ;
      sh:property [
        sh:path ex:address ;
        sh:maxCount 1 ;
        sh:node ex:AddressShape ;
      ] ;
      sh:property [
        sh:path ex:worksFor ;
        sh:nodeKind sh:IRI ;
      ] ;
      sh:closed true ;
      sh:ignoredProperties ( rdf:type ) .
    
    ex:AddressShape
      a sh:NodeShape ;
      sh:property [
        sh:path ex:postalCode ;
        sh:datatype xsd:string ;
        sh:maxCount 1 ;
      ] .
  `;

  let input: N3FilterExecutorInput<Store>;
  const parser = new ShaclFilterExecutor();

  beforeEach(async(): Promise<void> => {
    input = {
      config: {
        identifier: { path: 'path' },
        mappings: {},
        selectors: [],
        filter: 'filter',
        metadata: new RepresentationMetadata(),
      },
      filter: {
        data: new Store(new Parser().parse(shacl)),
        metadata: new RepresentationMetadata({ [RDF.type]: DERIVED_TYPES.terms.Shacl }),
      },
      data: new Store(new Parser().parse(turtle)),
    };
  });

  it('can only handle Shacl filters.', async(): Promise<void> => {
    input.filter.metadata.set(RDF.terms.type, DERIVED_TYPES.terms.String);
    await expect(parser.canHandle(input))
      .rejects.toThrow('Only supports SHACL filters');
  });

  it('extracts triples matching the shape.', async(): Promise<void> => {
    const result = await parser.handle(input);
    expect(result.metadata.contentType).toBe(INTERNAL_QUADS);
    const store = await readableToQuads(result.data);
    expect(store.size).toBe(3);
    expect(store.countQuads(
      'http://example.com/ns#Alice',
      'http://example.com/ns#worksFor',
      'http://example.com/ns#AliceCompany',
      null,
    )).toBe(1);
    const addresses = store.getObjects(
      'http://example.com/ns#Alice',
      'http://example.com/ns#address',
      null,
    );
    expect(addresses).toHaveLength(1);
    expect(store.countQuads(
      addresses[0],
      'http://example.com/ns#postalCode',
      '"1234"',
      null,
    )).toBe(1);
  });
});
