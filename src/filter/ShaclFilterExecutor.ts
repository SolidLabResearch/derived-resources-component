import { Readable } from 'node:stream';
import type { Quad, Term } from '@rdfjs/types';
import type { Representation } from '@solid/community-server';
import {
  BasicRepresentation,
  getLoggerFor,
  INTERNAL_QUADS,
  NotImplementedHttpError,
  RDF,
} from '@solid/community-server';
import type { Store } from 'n3';
import SHACLValidator from 'rdf-validate-shacl';
import { DERIVED_TYPES, SH } from '../Vocabularies';
import type { N3FilterExecutorInput } from './N3FilterExecutor';
import { N3FilterExecutor } from './N3FilterExecutor';

export interface PredicatePath extends Record<string, PredicatePath> {}

export class ShaclFilterExecutor extends N3FilterExecutor<Store> {
  protected readonly logger = getLoggerFor(this);

  public async canHandle(input: N3FilterExecutorInput<Store>): Promise<void> {
    const typed = input.filter.metadata.getAll(RDF.terms.type);
    if (!typed.some((term): boolean => term.equals(DERIVED_TYPES.terms.Shacl))) {
      throw new NotImplementedHttpError('Only supports SHACL filters');
    }
  }

  public async handle(input: N3FilterExecutorInput<Store>): Promise<Representation> {
    return new BasicRepresentation(
      Readable.from(this.extractMatchingTriples(input.data, input.filter.data)),
      input.config.identifier,
      INTERNAL_QUADS,
    );
  }

  protected* extractMatchingTriples(data: Store, shapes: Store): IterableIterator<Quad> {
    const validator = new SHACLValidator(shapes);
    const report = validator.validate(data);

    const paths: Record<string, PredicatePath> = {};
    for (const { focusNode, shapeNode } of this.findFocusNodes(data, shapes)) {
      if (report.dataset.match(null, SH.terms.focusNode, focusNode).size > 0) {
        continue;
      }
      const path = paths[shapeNode.value] ?? this.findValidPath(shapes, shapeNode);
      paths[shapeNode.value] = path;
      yield* this.extractValidTriples(data, path, focusNode);
    }
  }

  protected* findFocusNodes(data: Store, shapes: Store): IterableIterator<{ focusNode: Term; shapeNode: Term }> {
    for (const { subject: shapeNode, object: focusNode } of shapes.getQuads(null, SH.terms.targetNode, null, null)) {
      yield { focusNode, shapeNode };
    }

    for (const { subject: shapeNode, object: classNode } of shapes.getQuads(null, SH.terms.targetClass, null, null)) {
      for (const focusNode of data.getSubjects(RDF.terms.type, classNode, null)) {
        yield { focusNode, shapeNode };
      }
    }

    for (const { subject: shapeNode, object: pred } of shapes.getQuads(null, SH.terms.targetSubjectsOf, null, null)) {
      for (const focusNode of data.getSubjects(pred, null, null)) {
        yield { focusNode, shapeNode };
      }
    }

    for (const { subject: shapeNode, object: pred } of shapes.getQuads(null, SH.terms.targetObjectsOf, null, null)) {
      for (const focusNode of data.getObjects(null, pred, null)) {
        yield { focusNode, shapeNode };
      }
    }
  }

  protected findValidPath(shapes: Store, shapeNode: Term): PredicatePath {
    const result: PredicatePath = {};

    const properties = shapes.getObjects(shapeNode, SH.terms.property, null);
    for (const property of properties) {
      const pathObjects = shapes.getObjects(property, SH.terms.path, null);
      if (pathObjects.length !== 1) {
        this.logger.warn(`Skipping property with not exactly 1 sh:path node.`);
        continue;
      }
      const predicate = pathObjects[0];
      result[predicate.value] = result[predicate.value] ?? {};

      for (const node of shapes.getObjects(property, SH.terms.node, null)) {
        result[predicate.value] = this.mergePaths(result[predicate.value], this.findValidPath(shapes, node));
      }
    }

    return result;
  }

  protected mergePaths(pathA: PredicatePath, pathB: PredicatePath): PredicatePath {
    const result = { ...pathA };
    for (const key of Object.keys(pathB)) {
      if (result[key]) {
        result[key] = this.mergePaths(pathA[key], pathB[key]);
      } else {
        result[key] = pathB[key];
      }
    }
    return result;
  }

  protected* extractValidTriples(data: Store, path: PredicatePath, focusNode: Term): IterableIterator<Quad> {
    for (const [ key, childPath ] of Object.entries(path)) {
      for (const quad of data.getQuads(focusNode, key, null, null)) {
        yield quad;
        yield* this.extractValidTriples(data, childPath, quad.object);
      }
    }
  }
}
