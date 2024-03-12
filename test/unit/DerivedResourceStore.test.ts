import { BasicRepresentation, MethodNotAllowedHttpError, ResourceStore } from '@solid/community-server';
import { DerivationManager } from '../../src/DerivationManager';
import { DerivedResourceStore } from '../../src/DerivedResourceStore';

describe('DerivedResourceStore', (): void => {
  const identifier = { path: 'http://example.com/foo' };
  let source: jest.Mocked<ResourceStore>;
  let manager: jest.Mocked<DerivationManager>;
  let store: DerivedResourceStore;

  beforeEach(async(): Promise<void> => {
    source = {
      hasResource: jest.fn().mockResolvedValue(true),
      getRepresentation: jest.fn().mockResolvedValue('get'),
      addResource: jest.fn().mockResolvedValue('add'),
      setRepresentation: jest.fn().mockResolvedValue('set'),
      modifyResource: jest.fn().mockResolvedValue('modify'),
      deleteResource: jest.fn().mockResolvedValue('delete'),
    }

    manager = {
      isDerivedResource: jest.fn().mockResolvedValue(false),
      handleResource: jest.fn().mockResolvedValue('derived'),
    }

    store = new DerivedResourceStore(source, manager);
  });

  it('hasResource returns true if the resource exists.', async(): Promise<void> => {
    await expect(store.hasResource(identifier)).resolves.toBe(true);
    expect(source.hasResource).toHaveBeenCalledTimes(1);
    expect(source.hasResource).toHaveBeenLastCalledWith(identifier);
    expect(manager.isDerivedResource).toHaveBeenCalledTimes(0);
  });

  it('hasResource returns true if there is a matching derived resource.', async(): Promise<void> => {
    source.hasResource.mockResolvedValueOnce(false);
    manager.isDerivedResource.mockResolvedValueOnce(true);
    await expect(store.hasResource(identifier)).resolves.toBe(true);
    expect(source.hasResource).toHaveBeenCalledTimes(1);
    expect(source.hasResource).toHaveBeenLastCalledWith(identifier);
    expect(manager.isDerivedResource).toHaveBeenCalledTimes(1);
  });

  it('hasResource returns false otherwise.', async(): Promise<void> => {
    source.hasResource.mockResolvedValueOnce(false);
    await expect(store.hasResource(identifier)).resolves.toBe(false);
    expect(source.hasResource).toHaveBeenCalledTimes(1);
    expect(source.hasResource).toHaveBeenLastCalledWith(identifier);
    expect(manager.isDerivedResource).toHaveBeenCalledTimes(1);
  });

  it('getRepresentation returns the result of the manager.', async(): Promise<void> => {
    await expect(store.getRepresentation(identifier, {})).resolves.toBe('derived');
    expect(source.getRepresentation).toHaveBeenCalledTimes(0);
    expect(manager.handleResource).toHaveBeenCalledTimes(1);
    expect(manager.handleResource).toHaveBeenLastCalledWith(identifier, undefined);
  });

  it('other functions throw an error if the target is a derived resource.', async(): Promise<void> => {
    manager.isDerivedResource.mockResolvedValue(true);
    const error = new MethodNotAllowedHttpError([ 'POST', 'PUT', 'PATCH', 'DELETE' ]);
    await expect(store.addResource(identifier, new BasicRepresentation())).rejects.toThrow(error);
    await expect(store.setRepresentation(identifier, new BasicRepresentation())).rejects.toThrow(error);
    await expect(store.modifyResource(identifier, new BasicRepresentation())).rejects.toThrow(error);
    await expect(store.deleteResource(identifier)).rejects.toThrow(error);
  });

  it('calls the other functions if the target is not a derived resource.', async(): Promise<void> => {
    await expect(store.addResource(identifier, new BasicRepresentation())).resolves.toBe('add');
    await expect(store.setRepresentation(identifier, new BasicRepresentation())).resolves.toBe('set');
    await expect(store.modifyResource(identifier, new BasicRepresentation())).resolves.toBe('modify');
    await expect(store.deleteResource(identifier)).resolves.toBe('delete');
  });
});
