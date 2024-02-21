import { BlankNode, NamedNode, Term } from '@rdfjs/types';
import {
  getLoggerFor,
  InternalServerError,
  NotImplementedHttpError,
  ResourceIdentifier
} from '@solid/community-server';
import Template from 'uri-template-lite';
import { DerivationConfig, DerivationMatcher, DerivationMatcherInput } from './DerivationMatcher';
import { DERIVED } from './Vocabularies';

/**
 * Finds a matching derivation by matching the identifier to a template string.
 */
export class TemplateDerivationMatcher extends DerivationMatcher {
  protected logger = getLoggerFor(this);

  protected cache: WeakMap<ResourceIdentifier, Record<string, string>>

  public constructor() {
    super();
    this.cache = new WeakMap();
  }

  public async canHandle({ identifier, metadata, subject }: DerivationMatcherInput): Promise<void> {
    // Templates are relative to the resource they are linked to
    const relative = identifier.path.slice(metadata.identifier.value.length);
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
      throw new InternalServerError(`Derived resources need exactly 1 filter. Found ${filters.length} for ${subject.value}`);
    }

    this.logger.debug(`Found derived resource match for ${identifier.path} with subject ${subject.value}`);
    return {
      mappings: match,
      selectors: metadata.quads(subject as NamedNode, DERIVED.terms.selector).map((quad): string => quad.object.value),
      filter: filters[0].object.value,
    };
  }

  /**
   * Returns true if the term is a Named or Blank node.
   */
  protected isValidDerivedSubject(term: Term): term is NamedNode | BlankNode {
    return term.termType === 'NamedNode' || term.termType === 'BlankNode';
  }
}
