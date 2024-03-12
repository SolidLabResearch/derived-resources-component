import { Term } from '@rdfjs/types';
import {
  BasicRepresentation,
  Conditions,
  createErrorMessage,
  DC,
  getLoggerFor,
  IdentifierStrategy,
  INTERNAL_QUADS,
  NotFoundHttpError,
  Representation,
  RepresentationMetadata,
  ResourceIdentifier,
  ResourceStore,
  updateModifiedDate
} from '@solid/community-server';
import { DataFactory, Store } from 'n3';
import { once } from 'node:events';
import { DerivationManager } from './DerivationManager';
import { DerivationMatcher } from './DerivationMatcher';
import { FilterHandler } from './FilterHandler';
import { SelectorHandler } from './SelectorHandler';
import { DERIVED } from './Vocabularies';
import namedNode = DataFactory.namedNode;

interface DerivationConfig {
  mappings: Record<string, string>;
  selectors: string[];
  filter: string;
}

interface MetadataDerivationManagerArgs {
  derivationMatcher: DerivationMatcher;
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
 *
 * Metadata is added to the resulting resource to indicate which selectors and filters were used.
 */
export class MetadataDerivationManager implements DerivationManager {
  protected logger = getLoggerFor(this);

  protected derivationMatcher: DerivationMatcher;
  protected selectorHandler: SelectorHandler;
  protected filterHandler: FilterHandler;
  protected identifierStrategy: IdentifierStrategy;
  protected store: ResourceStore;

  public constructor(args: MetadataDerivationManagerArgs) {
    this.derivationMatcher = args.derivationMatcher;
    this.selectorHandler = args.selectorHandler;
    this.filterHandler = args.filterHandler;
    this.identifierStrategy = args.identifierStrategy;
    this.store = args.store;
  }

  public async isDerivedResource(identifier: ResourceIdentifier): Promise<boolean> {
    try {
      const representation = await this.getFirstExistingResource(identifier);
      const config = await this.findMatchingDerivation(identifier, representation.metadata);
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
      const config = await this.findMatchingDerivation(identifier, result.metadata);
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
        const config = await this.findMatchingDerivation(identifier, parent.metadata);
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
  protected async findMatchingDerivation(identifier: ResourceIdentifier, metadata: RepresentationMetadata): Promise<DerivationConfig | undefined> {
    const derived = metadata.getAll(DERIVED.terms.derivedResource);

    for (const subject of derived) {
      try {
        return await this.derivationMatcher.handleSafe({ identifier, metadata, subject })
      } catch (error: unknown) {
        this.logger.debug(`Did not found a valid derivation for ${identifier.path}: ${createErrorMessage(error)}`);
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

    // Add necessary metadata
    this.setLastModified(resultMetadata, sourceMetadatas);
    this.addDerivationMetadata(resultMetadata, config);

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
   * Adds triples to indicate all the resources that were used to generate the derived resource.
   */
  protected addDerivationMetadata(metadata: RepresentationMetadata, config: DerivationConfig): void {
    for (const selector of config.selectors) {
      metadata.add(DERIVED.terms.selector, namedNode(selector));
    }
    metadata.add(DERIVED.terms.filter, namedNode(config.filter));
  }
}
