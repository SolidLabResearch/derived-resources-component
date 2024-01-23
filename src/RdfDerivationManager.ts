import { NamedNode, Term } from '@rdfjs/types';
import {
  BasicRepresentation,
  Conditions,
  DC,
  IdentifierStrategy,
  INTERNAL_QUADS,
  NotFoundHttpError,
  Representation,
  RepresentationMetadata,
  ResourceIdentifier,
  ResourceStore,
  updateModifiedDate
} from '@solid/community-server';
import { Store } from 'n3';
import { once } from 'node:events';
import Template from 'uri-template-lite';
import { DerivationManager } from './DerivationManager';
import { FilterHandler } from './FilterHandler';
import { SelectorHandler } from './SelectorHandler';
import { DERIVED } from './Vocabularies';

// TODO: logging

interface DerivationConfig {
  mappings: Record<string, string>;
  selectors: string[];
  filter: string;
}

// TODO: name
export class RdfDerivationManager implements DerivationManager {
  protected selectorHandler: SelectorHandler;
  protected filterHandler: FilterHandler;
  protected identifierStrategy: IdentifierStrategy;
  protected store: ResourceStore;

  public constructor(selectorHandler: SelectorHandler, filterHandler: FilterHandler, identifierStrategy: IdentifierStrategy, store: ResourceStore) {
    this.selectorHandler = selectorHandler;
    this.filterHandler = filterHandler;
    this.identifierStrategy = identifierStrategy;
    this.store = store;
  }

  public async isDerivedResource(identifier: ResourceIdentifier): Promise<boolean> {
    const representation = await this.getFirstExistingResource(identifier);
    const config = this.findMatchingDerivation(identifier, representation.metadata);
    return Boolean(config);
  }

  public async handleResource(identifier: ResourceIdentifier, conditions?: Conditions): Promise<Representation> {
    try {
      const result = await this.store.getRepresentation(identifier, {}, conditions);
      const config = this.findMatchingDerivation(identifier, result.metadata);
      if (config) {
        return this.deriveResource(identifier, config);
      }
      return result;
    } catch(error: unknown) {
      if (NotFoundHttpError.isInstance(error)) {
        const parent = await this.getFirstExistingResource(this.identifierStrategy.getParentContainer(identifier));
        const config = this.findMatchingDerivation(identifier, parent.metadata);
        if (config) {
          return this.deriveResource(identifier, config);
        }
      }
      throw error;
    }
  }

  protected async getFirstExistingResource(identifier: ResourceIdentifier): Promise<Representation> {
    try {
      // `await` is important here to make sure the error triggers
      return await this.store.getRepresentation(identifier, {});
    } catch(error: unknown) {
      const parent = this.identifierStrategy.getParentContainer(identifier);
      if (NotFoundHttpError.isInstance(error)) {
        return this.getFirstExistingResource(parent);
      }
      throw error;
    }
  }

  protected findMatchingDerivation(identifier: ResourceIdentifier, metadata: RepresentationMetadata): DerivationConfig | undefined {
    const derived = metadata.getAll(DERIVED.terms.derivedResource) as NamedNode[];
    const relative = identifier.path.slice(metadata.identifier.value.length);

    for (const entry of derived) {
      const template = metadata.quads(entry, DERIVED.terms.template)[0].object;
      const match = new Template(template.value).match(relative);
      if (match) {
        // TODO: this is where we should cache?
        // TODO: failsafes for all quads calls on length and typings of the results
        return {
          mappings: match,
          selectors: metadata.quads(entry, DERIVED.terms.selector).map((quad): string => quad.object.value),
          filter: metadata.quads(entry, DERIVED.terms.filter).map((quad): string => quad.object.value)[0],
        };
      }
    }
  }

  protected async deriveResource(identifier: ResourceIdentifier, config: DerivationConfig): Promise<Representation> {
    // Store that contains the triples of all selectors
    const data = new Store();

    // Collect data from all selectors
    const sources = (await Promise.all(
      config.selectors.map((selector): Promise<ResourceIdentifier[]> => this.selectorHandler.handleSafe({ mappings: config.mappings, selector }))
    )).flat();
    const sourceMetadatas = await Promise.all(sources.map((source): Promise<RepresentationMetadata> =>
      this.importSource(data, source)));

    const result = await this.filterHandler.handleSafe({ mappings: config.mappings, filter: config.filter, data });

    // Set the last modified time to that of the last modified source
    const resultMetadata = new RepresentationMetadata(identifier, INTERNAL_QUADS);
    this.setLastModified(resultMetadata, sourceMetadatas);

    return new BasicRepresentation(result, resultMetadata);
  }

  // TODO:
  protected async importSource(store: Store, identifier: ResourceIdentifier): Promise<RepresentationMetadata> {
    // TODO: can't have recursive derived resources because we only have 1 store here
    const representation = await this.store.getRepresentation(identifier, { type: { [INTERNAL_QUADS]: 1 } });
    const emitter = store.import(representation.data);
    await once(emitter, 'end');
    return representation.metadata;
  }

  // TODO:
  protected setLastModified(resultMetadata: RepresentationMetadata, sourceMetadatas: RepresentationMetadata[]): void {
    const lastModified = Math.max(...sourceMetadatas.map((metadata): Term | undefined => metadata.get(DC.terms.modified))
      .filter(Boolean)
      .map((term): number => new Date(term!.value).getTime()));
    // Will be -Infinity if there were no matches
    if (lastModified > 0) {
      updateModifiedDate(resultMetadata, new Date(lastModified));
    }
  }
}
