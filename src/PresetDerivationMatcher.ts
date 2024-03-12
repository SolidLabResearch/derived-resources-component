import { DerivationConfig, DerivationMatcher, DerivationMatcherInput } from './DerivationMatcher';

/**
 * Adds certain preset values to the resulting mappings of another {@link DerivationMatcher}.
 * `source` will be set to the identifier of the resource where the metadata was found.
 * `identifier` will be set to the identifier of the resource being accessed.
 */
export class PresetDerivationMatcher extends DerivationMatcher {
  protected source: DerivationMatcher;

  public constructor(source: DerivationMatcher) {
    super();
    this.source = source;
  }

  public async canHandle(input: DerivationMatcherInput): Promise<void> {
    return this.source.canHandle(input);
  }

  public async handle(input: DerivationMatcherInput): Promise<DerivationConfig> {
    const result = await this.source.handle(input);
    const mappings = {
      ...result.mappings,
      source: input.metadata.identifier.value,
      identifier: input.identifier.path,
    };
    return {
      ...result,
      mappings
    };
  }
}
