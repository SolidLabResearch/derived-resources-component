import { BlankNode, NamedNode, Term } from '@rdfjs/types';
import {
  BasicRepresentation,
  Conditions,
  DC, getLoggerFor,
  IdentifierStrategy,
  INTERNAL_QUADS,
  NotFoundHttpError,
  Representation,
  RepresentationMetadata,
  ResourceIdentifier,
  ResourceStore,
  updateModifiedDate
} from '@solid/community-server';
import { Store, Util } from 'n3';
import { once } from 'node:events';
import Template from 'uri-template-lite';
import { DerivationManager } from './DerivationManager';
import { FilterHandler } from './FilterHandler';
import { SelectorHandler } from './SelectorHandler';
import { DERIVED } from './Vocabularies';

interface DerivationConfig {
  mappings: Record<string, string>;
  selectors: string[];
  filter: string;
}

interface MetadataDerivationManagerArgs {
  selectorHandler: SelectorHandler;
  filterHandler: FilterHandler;
  identifierStrategy: IdentifierStrategy;
  /**
   * The store that will be used to access the data.
   * Chances are this manager will be called by a store itself,
   * so it's important to make sure there are no dependency cycles here.
   */
  store: ResourceStore;
}

/**
 * A {@link DerivationManager} that makes use of metadata triples to determine if a resource is a derived resource.
 * To determine if a resource is a derived resource it goes up the container chain, starting from the input identifier,
 * to find the first resource that exists.
 * It then verifies if certain triples are present
 * that identify the original identifier as corresponding to a derived resource.
 * For more information on what these triples should look like, check the README.
 *
 * To generate the derived resource representation, a {@link SelectorHandler} is called for each selector triple.
 * The triples of these selectors get merged into a single RDF dataset,
 * which is then sent to a {@link FilterHandler} to generate an output stream.
 */
export class MetadataDerivationManager implements DerivationManager {
  protected logger = getLoggerFor(this);

  protected selectorHandler: SelectorHandler;
  protected filterHandler: FilterHandler;
  protected identifierStrategy: IdentifierStrategy;
  protected store: ResourceStore;

  public constructor(args: MetadataDerivationManagerArgs) {
    this.selectorHandler = args.selectorHandler;
    this.filterHandler = args.filterHandler;
    this.identifierStrategy = args.identifierStrategy;
    this.store = args.store;
  }

  public async isDerivedResource(identifier: ResourceIdentifier): Promise<boolean> {
    try {
      const representation = await this.getFirstExistingResource(identifier);
      const config = this.findMatchingDerivation(identifier, representation.metadata);
      return Boolean(config);
    } catch(error: unknown) {
      // Depending on the backend, it is possible that the root container does not exist yet which could throw an error
      if (NotFoundHttpError.isInstance(error)) {
        return false;
      }
      throw error;
    }
  }

  public async handleResource(identifier: ResourceIdentifier, conditions?: Conditions): Promise<Representation> {
    try {
      const result = await this.store.getRepresentation(identifier, {}, conditions);
      const config = this.findMatchingDerivation(identifier, result.metadata);
      if (config) {
        return this.deriveResource(identifier, config, result);
      }
      // Return the original result if this is not a derived resource
      return result;
    } catch(error: unknown) {
      if (NotFoundHttpError.isInstance(error) && !this.identifierStrategy.isRootContainer(identifier)) {
        this.logger.debug(`${identifier.path} does not exist, going up the container chain.`);
        // In case the target does not exist, find the first parent container that does
        const parent = await this.getFirstExistingResource(this.identifierStrategy.getParentContainer(identifier));
        this.logger.debug(`${parent.metadata.identifier.value} is the first parent container that exists for ${identifier.path}`);
        const config = this.findMatchingDerivation(identifier, parent.metadata);
        if (config) {
          return this.deriveResource(identifier, config);
        }
      }
      // Throw the error anyway if this is not a derived resource
      throw error;
    }
  }

  /**
   * Finds the first resource in the container chain that exists, starting from the given identifier.
   */
  protected async getFirstExistingResource(identifier: ResourceIdentifier): Promise<Representation> {
    try {
      // `await` is important here to make sure the error triggers
      return await this.store.getRepresentation(identifier, {});
    } catch(error: unknown) {
      if (NotFoundHttpError.isInstance(error) && !this.identifierStrategy.isRootContainer(identifier)) {
        const parent = this.identifierStrategy.getParentContainer(identifier);
        return this.getFirstExistingResource(parent);
      }
      throw error;
    }
  }

  /**
   * Finds the derivation triples in the given metadata that correspond to the given identifier, if any.
   */
  protected findMatchingDerivation(identifier: ResourceIdentifier, metadata: RepresentationMetadata): DerivationConfig | undefined {
    const derived = metadata.getAll(DERIVED.terms.derivedResource);
    // Templates are relative to the resource they are linked to
    const relative = identifier.path.slice(metadata.identifier.value.length);

    for (const entry of derived) {
      if (!this.isValidDerivedSubject(entry)) {
        this.logger.error(`Subjects of derived:derivedResource should be Named or Blank nodes, found a ${entry.termType} with value ${entry.value}`);
        continue;
      }

      const templates = metadata.quads(entry, DERIVED.terms.template);
      if (templates.length !== 1) {
        this.logger.error(`Derived resources need exactly 1 template. Found ${templates.length} for ${entry.value}`);
        continue;
      }
      const template = templates[0].object.value;

      const match = new Template(template).match(relative);
      if (match) {
        const filters = metadata.quads(entry, DERIVED.terms.filter);
        if (filters.length !== 1) {
          this.logger.error(`Derived resources need exactly 1 filter. Found ${filters.length} for ${entry.value}`);
          continue;
        }

        this.logger.debug(`Found derived resource match for ${identifier.path} with subject ${entry.value} and template ${template}`);
        return {
          mappings: match,
          selectors: metadata.quads(entry, DERIVED.terms.selector).map((quad): string => quad.object.value),
          filter: filters[0].object.value,
        };
      }
    }
  }

  /**
   * Generates the representation for the derived resource.
   */
  protected async deriveResource(identifier: ResourceIdentifier, config: DerivationConfig, representation?: Representation): Promise<Representation> {
    this.logger.debug(`Deriving contents of resource ${identifier.path}`);

    // Collect data from all selectors
    const data = new Store();
    const sourceMetadatas = await this.importSelectors(data, config);

    // Apply the filter to the data
    const result = await this.filterHandler.handleSafe({ mappings: config.mappings, filter: config.filter, data });

    // Reuse metadata if the resource had existing metadata
    const resultMetadata = representation?.metadata ?? new RepresentationMetadata(identifier);
    resultMetadata.contentType = INTERNAL_QUADS;

    // Set the last modified time to that of the last modified source
    this.setLastModified(resultMetadata, sourceMetadatas);

    return new BasicRepresentation(result, resultMetadata);
  }

  /**
   * Imports all RDF data from the selectors stored in the config.
   * For every source returned by a selector, the corresponding metadata is returned.
   */
  protected async importSelectors(data: Store, config: DerivationConfig): Promise<RepresentationMetadata[]> {
    const promises = config.selectors.map(async(selector): Promise<RepresentationMetadata[]> => {
      // Get all sources for the given selector
      const sources = await this.selectorHandler.handleSafe({ mappings: config.mappings, selector });
      // Import all these sources and return their metadata
      return Promise.all(sources.map((source) => this.importSource(data, source)));
    });
    // Flatten the results of all selectors into a single array
    return (await Promise.all(promises)).flat();
  }

  /**
   * Imports the data from the given source into the store and returns the corresponding metadata.
   */
  protected async importSource(store: Store, identifier: ResourceIdentifier): Promise<RepresentationMetadata> {
    const representation = await this.store.getRepresentation(identifier, { type: { [INTERNAL_QUADS]: 1 } });
    const emitter = store.import(representation.data);
    await once(emitter, 'end');
    return representation.metadata;
  }

  /**
   * Sets the last-modified date of the resulting derived resource to that of the highest value in the sources.
   */
  protected setLastModified(resultMetadata: RepresentationMetadata, sourceMetadatas: RepresentationMetadata[]): void {
    const lastModified = Math.max(...sourceMetadatas.map((metadata): Term | undefined => metadata.get(DC.terms.modified))
      .filter(Boolean)
      .map((term): number => new Date(term!.value).getTime()));
    // Will be -Infinity if there were no matches
    if (lastModified > 0) {
      updateModifiedDate(resultMetadata, new Date(lastModified));
    }
  }

  /**
   * Returns true if the term is a Named or Blank node.
   */
  protected isValidDerivedSubject(term: Term): term is NamedNode | BlankNode {
    return term.termType === 'NamedNode' || term.termType === 'BlankNode';
  }
}
