import {
  createErrorMessage,
  getLoggerFor,
  Representation,
  RepresentationMetadata,
  ResourceIdentifier
} from '@solid/community-server';
import { DerivationMatcher } from './config/DerivationMatcher';
import { DerivationConfig } from './DerivationConfig';
import { DerivationManager } from './DerivationManager';
import { FilterHandler } from './filter/FilterHandler';
import { SelectorHandler } from './selector/SelectorHandler';
import { DERIVED } from './Vocabularies';

interface MetadataDerivationManagerArgs {
  derivationMatcher: DerivationMatcher;
  selectorHandler: SelectorHandler;
  filterHandler: FilterHandler;
}

/**
 * Derives resource information with the use of several helper classes.
 * The {@link DerivationMatcher} determines the metadata that corresponds to the incoming identifier,
 * the {@link SelectorHandler} determines the input sources,
 * and the {@link FilterHandler} filters the relevant data from the input sources.
 */
export class BaseDerivationManager implements DerivationManager {
  protected logger = getLoggerFor(this);

  protected derivationMatcher: DerivationMatcher;
  protected selectorHandler: SelectorHandler;
  protected filterHandler: FilterHandler;

  public constructor(args: MetadataDerivationManagerArgs) {
    this.derivationMatcher = args.derivationMatcher;
    this.selectorHandler = args.selectorHandler;
    this.filterHandler = args.filterHandler;
  }

  /**
   * Finds the derivation triples in the given metadata that correspond to the given identifier, if any.
   */
  public async getDerivationConfig(identifier: ResourceIdentifier, metadata: RepresentationMetadata): Promise<DerivationConfig | undefined> {
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
  public async deriveResource(identifier: ResourceIdentifier, config: DerivationConfig): Promise<Representation> {
    this.logger.debug(`Deriving contents of resource ${identifier.path}`);

    const representations = await this.selectorHandler.handleSafe(config);

    // Apply the filter to the data
    return this.filterHandler.handleSafe({ config, representations });
  }
}
