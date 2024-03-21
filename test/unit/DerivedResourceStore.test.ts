import {
  BasicRepresentation,
  INTERNAL_QUADS,
  MethodNotAllowedHttpError,
  NotFoundHttpError,
  Representation,
  ResourceStore,
  SingleRootIdentifierStrategy
} from '@solid/community-server';
import { DataFactory } from 'n3';
import { DerivationManager } from '../../src/DerivationManager';
import { DerivedResourceStore } from '../../src/DerivedResourceStore';
import namedNode = DataFactory.namedNode;

describe('DerivedResourceStore', (): void => {
  const identifier = { path: 'https://example.com/foo' };
  const config = 'config';
  let representation: Representation;
  let derivedRepresentation: Representation;
  let source: jest.Mocked<ResourceStore>;
  const identifierStrategy = new SingleRootIdentifierStrategy('https://example.com/');
  let manager: jest.Mocked<DerivationManager>;
  let store: DerivedResourceStore;

  beforeEach(async(): Promise<void> => {
    representation = new BasicRepresentation('', identifier, 'text/turtle');
    representation.metadata.add(namedNode('knows'), namedNode('someone'));
    source = {
      hasResource: jest.fn().mockResolvedValue(true),
      getRepresentation: jest.fn().mockResolvedValue(representation),
      addResource: jest.fn().mockResolvedValue('add'),
      setRepresentation: jest.fn().mockResolvedValue('set'),
      modifyResource: jest.fn().mockResolvedValue('modify'),
      deleteResource: jest.fn().mockResolvedValue('delete'),
    }

    derivedRepresentation = new BasicRepresentation('derived', identifier, INTERNAL_QUADS);
    manager = {
      getDerivationConfig: jest.fn().mockResolvedValue(config),
      deriveResource: jest.fn().mockResolvedValue(derivedRepresentation),
    }

    store = new DerivedResourceStore(source, manager, identifierStrategy);
  });

  it('hasResource returns true if the resource exists.', async(): Promise<void> => {
    await expect(store.hasResource(identifier)).resolves.toBe(true);
    expect(source.hasResource).toHaveBeenCalledTimes(1);
    expect(source.hasResource).toHaveBeenLastCalledWith(identifier);
    expect(manager.getDerivationConfig).toHaveBeenCalledTimes(0);
  });

  it('hasResource returns true if there is a matching derived resource.', async(): Promise<void> => {
    source.hasResource.mockResolvedValueOnce(false);
    await expect(store.hasResource(identifier)).resolves.toBe(true);
    expect(source.hasResource).toHaveBeenCalledTimes(1);
    expect(source.hasResource).toHaveBeenLastCalledWith(identifier);
    expect(manager.getDerivationConfig).toHaveBeenCalledTimes(1);
  });

  it('hasResource returns false otherwise.', async(): Promise<void> => {
    source.hasResource.mockResolvedValueOnce(false);
    manager.getDerivationConfig.mockResolvedValueOnce(undefined);
    await expect(store.hasResource(identifier)).resolves.toBe(false);
    expect(source.hasResource).toHaveBeenCalledTimes(1);
    expect(source.hasResource).toHaveBeenLastCalledWith(identifier);
    expect(manager.getDerivationConfig).toHaveBeenCalledTimes(1);
  });

  it('hasResource returns false if the root container does not exist yet.', async(): Promise<void> => {
    source.hasResource.mockResolvedValue(false);
    source.getRepresentation.mockRejectedValue(new NotFoundHttpError());
    await expect(store.hasResource(identifier)).resolves.toBe(false);
    expect(source.hasResource).toHaveBeenCalledTimes(1);
    expect(source.hasResource).toHaveBeenLastCalledWith(identifier);
    expect(manager.getDerivationConfig).toHaveBeenCalledTimes(0);
  });

  it('getRepresentation returns the original representation if there is no config.', async(): Promise<void> => {
    manager.getDerivationConfig.mockResolvedValueOnce(undefined);
    await expect(store.getRepresentation(identifier, {})).resolves.toBe(representation);
    expect(manager.deriveResource).toHaveBeenCalledTimes(0);
  });

  it('getRepresentation throws a 404 if the target does not exist and there is no config.', async(): Promise<void> => {
    manager.getDerivationConfig.mockResolvedValueOnce(undefined);
    source.getRepresentation.mockRejectedValueOnce(new NotFoundHttpError());
    source.getRepresentation.mockResolvedValueOnce(new BasicRepresentation('', { path: 'https://example.com/' }));
    await expect(store.getRepresentation(identifier, {})).rejects.toThrow(NotFoundHttpError);
    expect(manager.deriveResource).toHaveBeenCalledTimes(0);
  });

  it('getRepresentation returns the derived result if there is one.', async(): Promise<void> => {
    await expect(store.getRepresentation(identifier, {})).resolves.toBe(derivedRepresentation);
    expect(manager.deriveResource).toHaveBeenLastCalledWith(identifier, config);
    expect(derivedRepresentation.metadata.contentType).toBe(INTERNAL_QUADS);
    expect(derivedRepresentation.metadata.has(namedNode('knows'), namedNode('someone'))).toBe(true);
  });

  it('getRepresentation returns the derived result if the parent metadata contains it.', async(): Promise<void> => {
    source.getRepresentation.mockRejectedValueOnce(new NotFoundHttpError());
    source.getRepresentation.mockResolvedValueOnce(new BasicRepresentation('', { path: 'https://example.com/' }));
    await expect(store.getRepresentation(identifier, {})).resolves.toBe(derivedRepresentation);
    expect(manager.deriveResource).toHaveBeenLastCalledWith(identifier, config);
  });

  it('other functions throw an error if the target is a derived resource.', async(): Promise<void> => {
    const error = new MethodNotAllowedHttpError([ 'POST', 'PUT', 'PATCH', 'DELETE' ]);
    await expect(store.addResource(identifier, new BasicRepresentation())).rejects.toThrow(error);
    await expect(store.setRepresentation(identifier, new BasicRepresentation())).rejects.toThrow(error);
    await expect(store.modifyResource(identifier, new BasicRepresentation())).rejects.toThrow(error);
    await expect(store.deleteResource(identifier)).rejects.toThrow(error);
  });

  it('calls the other functions if the target is not a derived resource.', async(): Promise<void> => {
    manager.getDerivationConfig.mockResolvedValue(undefined);
    await expect(store.addResource(identifier, new BasicRepresentation())).resolves.toBe('add');
    await expect(store.setRepresentation(identifier, new BasicRepresentation())).resolves.toBe('set');
    await expect(store.modifyResource(identifier, new BasicRepresentation())).resolves.toBe('modify');
    await expect(store.deleteResource(identifier)).resolves.toBe('delete');
  });
});
