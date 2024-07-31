import type { BlankNode, NamedNode, Quad, Term } from '@rdfjs/types';
import type {
  ResourceIdentifier,
} from '@solid/community-server';
import {
  getLoggerFor,
  InternalServerError,
  NotImplementedHttpError,
  RepresentationMetadata,
} from '@solid/community-server';
import Template from 'uri-template-lite';
import type { DerivationConfig } from '../DerivationConfig';
import { isQueryResourceIdentifier } from '../QueryResourceIdentifier';
import { DERIVED } from '../Vocabularies';
import type { DerivationMatcherInput } from './DerivationMatcher';
import { DerivationMatcher } from './DerivationMatcher';

/**
 * Finds a matching derivation by matching the identifier to a template string.
 *
 * Already generates the result in the `canHandle` call and stores it in a {@link WeakMap}
 * to prevent double work.
 */
export class TemplateDerivationMatcher extends DerivationMatcher {
  protected logger = getLoggerFor(this);

  protected cache: WeakMap<ResourceIdentifier, Record<string, string>>;

  public constructor() {
    super();
    this.cache = new WeakMap();
  }

  public async canHandle({ identifier, metadata, subject }: DerivationMatcherInput): Promise<void> {
    // Add query params so template match can be checked
    let path = identifier.path;
    if (isQueryResourceIdentifier(identifier)) {
      const url = new URL(path);
      for (const [ key, value ] of Object.entries(identifier.query)) {
        url.searchParams.append(key, value);
      }
      path = url.toString();
    }
    // Templates are relative to the resource they are linked to
    const relative = path.slice(metadata.identifier.value.length);
    if (!this.isValidDerivedSubject(subject)) {
      throw new NotImplementedHttpError();
    }

    const templates = metadata.quads(subject, DERIVED.terms.template);
    if (templates.length !== 1) {
      throw new NotImplementedHttpError();
    }
    const template = templates[0].object.value;

    const match = new Template(template).match(relative);
    if (!match) {
      throw new NotImplementedHttpError();
    }
    this.cache.set(identifier, match);
  }

  public async handle({ identifier, metadata, subject }: DerivationMatcherInput): Promise<DerivationConfig> {
    const match = this.cache.get(identifier);
    if (!match) {
      throw new InternalServerError(`Calling handle without a successful canHandle call.`);
    }

    const filters = metadata.quads(subject as NamedNode, DERIVED.terms.filter);
    if (filters.length !== 1) {
      throw new InternalServerError(`Derived resources need exactly 1 filter. Found ${
        filters.length} for ${subject.value}`);
    }

    const configMetadata = new RepresentationMetadata(subject as NamedNode);
    configMetadata.addQuads([ ...this.getRelevantQuads(subject, metadata) ]);

    this.logger.debug(`Found derived resource match for ${identifier.path} with subject ${subject.value}`);
    return {
      identifier,
      mappings: match,
      selectors: metadata.quads(subject as NamedNode, DERIVED.terms.selector).map((quad): string => quad.object.value),
      filter: filters[0].object.value,
      metadata: configMetadata,
    };
  }

  /**
   * Returns true if the term is a Named or Blank node.
   */
  protected isValidDerivedSubject(term: Term): term is NamedNode | BlankNode {
    return term.termType === 'NamedNode' || term.termType === 'BlankNode';
  }

  protected* getRelevantQuads(
    subject: Term,
    metadata: RepresentationMetadata,
    cache: Set<string> = new Set(),
  ): Iterable<Quad> {
    if (subject.termType !== 'NamedNode' && subject.termType !== 'BlankNode') {
      return;
    }
    if (cache.has(subject.value)) {
      return;
    }
    cache.add(subject.value);
    const quads = metadata.quads(subject);
    yield* quads;

    for (const quad of quads) {
      yield* this.getRelevantQuads(quad.object, metadata, cache);
    }
  }
}
