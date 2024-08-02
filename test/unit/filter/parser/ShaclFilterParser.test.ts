import { InternalServerError, RepresentationMetadata } from '@solid/community-server';
import type { DerivationConfig } from '../../../../src/DerivationConfig';
import { ShaclFilterParser } from '../../../../src/filter/parser/ShaclFilterParser';
import { DERIVED_TYPES, SH } from '../../../../src/Vocabularies';

describe('ShaclFilterParser', (): void => {
  const shacl = `
    @prefix ex: <http://example.com/ns#>.
    @prefix sh: <http://www.w3.org/ns/shacl#>.
  
    ex:PersonShape
      a sh:NodeShape ;
      sh:targetClass ex:Person ;
      sh:property [
        sh:path ex:worksFor ;
        sh:nodeKind sh:IRI ;
      ] .
  `;
  let config: DerivationConfig;
  let parser: ShaclFilterParser;

  beforeEach(async(): Promise<void> => {
    config = {
      filter: shacl,
      selectors: [],
      mappings: {},
      identifier: { path: 'http://example.com' },
      metadata: new RepresentationMetadata(),
    };

    parser = new ShaclFilterParser();
  });

  it('expects at least 1 sh:property.', async(): Promise<void> => {
    config.filter = `
      @prefix ex: <http://example.com/ns#>.
      @prefix sh: <http://www.w3.org/ns/shacl#>.
    
      ex:PersonShape a sh:NodeShape.
    `;
    await expect(parser.canHandle(config))
      .rejects.toThrow('Expected at least one sh:property predicate in a SHACL resource');
  });

  it('rejects handle requests without a preceding canHandle.', async(): Promise<void> => {
    await expect(parser.handle(config)).rejects.toThrow(InternalServerError);
  });

  it('returns a shacl filter.', async(): Promise<void> => {
    await expect(parser.canHandle(config)).resolves.toBeUndefined();
    const result = await parser.handle(config);
    expect(result.data.countQuads(null, SH.terms.property, null, null)).toBe(1);
    expect(result.type.equals(DERIVED_TYPES.terms.Shacl)).toBe(true);
    expect(result.checksum).toBe(config.filter);
  });
});
