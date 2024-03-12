import {
  BasicRepresentation, DC,
  guardedStreamFrom,
  INTERNAL_QUADS,
  NotFoundHttpError,
  NotImplementedHttpError,
  readableToString,
  RepresentationMetadata,
  ResourceStore,
  SingleRootIdentifierStrategy
} from '@solid/community-server';
import { DataFactory } from 'n3';
import { DerivationConfig, DerivationMatcher } from '../../src/DerivationMatcher';
import { FilterHandler } from '../../src/FilterHandler';
import { MetadataDerivationManager } from '../../src/MetadataDerivationManager';
import { SelectorHandler } from '../../src/SelectorHandler';
import { DERIVED } from '../../src/Vocabularies';
import namedNode = DataFactory.namedNode;

describe('MetadataDerivationManager', (): void => {
  let config: DerivationConfig;
  const identifier = { path: 'https://example.com/foo' };
  const selector = 'https://example.com/selector'
  const filter = 'https://example.com/filter';
  let metadata: RepresentationMetadata;
  const subject = namedNode('urn:derived:subject');
  const template = 'foo';
  const date = new Date(1988, 2, 9);

  let derivationMatcher: jest.Mocked<DerivationMatcher>;
  let selectorHandler: jest.Mocked<SelectorHandler>;
  let filterHandler: jest.Mocked<FilterHandler>;
  const identifierStrategy = new SingleRootIdentifierStrategy('https://example.com/');
  let store: jest.Mocked<ResourceStore>;
  let manager: MetadataDerivationManager;

  beforeEach(async(): Promise<void> => {
    config = {
      mappings: {},
      selectors: [ selector ],
      filter,
    }

    metadata = new RepresentationMetadata();
    metadata.add(DERIVED.terms.derivedResource, subject);
    metadata.addQuad(subject, DERIVED.terms.template, template);
    metadata.addQuad(subject, DERIVED.terms.selector, selector);
    metadata.addQuad(subject, DERIVED.terms.filter, filter);

    derivationMatcher = {
      handleSafe: jest.fn().mockResolvedValue(config)
    } satisfies Partial<DerivationMatcher> as any;

    selectorHandler = {
      handleSafe: jest.fn().mockResolvedValue([ { path: selector } ])
    } satisfies Partial<SelectorHandler> as any;

    filterHandler  = {
      handleSafe: jest.fn().mockResolvedValue(guardedStreamFrom('derived'))
    } satisfies Partial<FilterHandler> as any;

    store = {
      getRepresentation: jest.fn(async(id) => {
        if (id.path === selector) {
          return new BasicRepresentation('', new RepresentationMetadata({ [DC.modified]: date.toISOString() }));
        }
        return new BasicRepresentation('', metadata);
      }),
    } satisfies Partial<ResourceStore> as any;

    manager = new MetadataDerivationManager({
      derivationMatcher,
      selectorHandler,
      filterHandler,
      identifierStrategy,
      store
    });
  });

  it('confirms resources with wrong metadata are not derived.', async(): Promise<void> => {
    store.getRepresentation.mockResolvedValueOnce(new BasicRepresentation());
    await expect(manager.isDerivedResource(identifier)).resolves.toBe(false);
  });

  it('confirms resources with correct metadata are derived.', async(): Promise<void> => {
    await expect(manager.isDerivedResource(identifier)).resolves.toBe(true);
  });

  it('confirms resources with no data but with correct parent metadata are derived.', async(): Promise<void> => {
    store.getRepresentation.mockRejectedValueOnce(new NotFoundHttpError());
    await expect(manager.isDerivedResource(identifier)).resolves.toBe(true);
  });

  it('confirms resources not matching the template are not derived.', async(): Promise<void> => {
    derivationMatcher.handleSafe.mockRejectedValueOnce(new NotImplementedHttpError());
    await expect(manager.isDerivedResource(identifier)).resolves.toBe(false);
  });

  it('returns the derived result with correct metadata.', async(): Promise<void> => {
    let result = await manager.handleResource(identifier);
    await expect(readableToString(result.data)).resolves.toBe('derived');
    expect(result.metadata.contentType).toBe(INTERNAL_QUADS);
    expect(result.metadata.get(DC.terms.modified)?.value).toBe(date.toISOString());
  });

  it('returns the original resource if there is no derivation metadata.', async(): Promise<void> => {
    store.getRepresentation.mockResolvedValueOnce(new BasicRepresentation('test', 'text/plain'));
    let result = await manager.handleResource(identifier);
    await expect(readableToString(result.data)).resolves.toBe('test');
  });

  it('returns the derived result if the parent contains the relevant metadata.', async(): Promise<void> => {
    store.getRepresentation.mockRejectedValueOnce(new NotFoundHttpError());
    let result = await manager.handleResource(identifier);
    await expect(readableToString(result.data)).resolves.toBe('derived');
    expect(result.metadata.contentType).toBe(INTERNAL_QUADS);
    expect(result.metadata.get(DC.terms.modified)?.value).toBe(date.toISOString());
  });
});
