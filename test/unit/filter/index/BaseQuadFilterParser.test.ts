import type { Quad } from '@rdfjs/types';
import { BasicRepresentation, INTERNAL_QUADS, readableToQuads } from '@solid/community-server';
import { DataFactory } from 'n3';
import { BaseQuadFilterParser } from '../../../../src/filter/idx/BaseQuadFilterParser';

describe('A BaseQuadFilterParser', (): void => {
  const filter: Partial<Quad> = {
    predicate: DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
    object: DataFactory.variable('v'),
  };
  const subject = DataFactory.namedNode('subject');
  const typeNode = DataFactory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
  const otherNode = DataFactory.namedNode('http://xmlns.com/foaf/0.1/topic');
  const type1 = DataFactory.namedNode('http://xmlns.com/foaf/0.1/Agent');
  const type2 = DataFactory.namedNode('http://xmlns.com/foaf/0.1/Person');
  const quads = [
    DataFactory.quad(subject, typeNode, type1),
    DataFactory.quad(subject, typeNode, type2),
    DataFactory.quad(subject, otherNode, type1),
  ];
  const parser = new BaseQuadFilterParser();

  it('filters matching quads from the stream.', async(): Promise<void> => {
    const representation = new BasicRepresentation(quads, INTERNAL_QUADS);
    const result = await parser.handle({ filter, representation });
    expect(result.readableObjectMode).toBe(true);
    const store = await readableToQuads(result);
    expect(store.countQuads(null, null, null, null)).toBe(2);
    expect(store.countQuads(subject, typeNode, type1, null)).toBe(1);
    expect(store.countQuads(subject, typeNode, type2, null)).toBe(1);
  });
});
