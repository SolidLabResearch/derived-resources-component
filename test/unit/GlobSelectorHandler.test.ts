import { BasicRepresentation, LDP, RepresentationMetadata, ResourceStore } from '@solid/community-server';
import { GlobSelectorHandler } from '../../src/GlobSelectorHandler';

describe('A GlobSelectorHandler', (): void => {
  let store: jest.Mocked<ResourceStore>;
  let handler: GlobSelectorHandler;
  const mappings = {};

  beforeEach(async(): Promise<void> => {
    store = {
      hasResource: jest.fn().mockResolvedValue(true),
      getRepresentation: jest.fn().mockResolvedValue(new BasicRepresentation([], '')),
    } satisfies Partial<ResourceStore> as any;

    handler = new GlobSelectorHandler(store);
  });

  function setMetadata(paths: string[]) {
    const metadata = new RepresentationMetadata();
    for (const path of paths) {
      metadata.add(LDP.terms.contains, path);
    }
    store.getRepresentation.mockResolvedValueOnce(new BasicRepresentation([], metadata));
  }

  it('returns the path itself if there is no glob.', async(): Promise<void> => {
    await expect(handler.handle({ selector: '/test', mappings })).resolves.toEqual([ { path: '/test' } ]);
  });

  it('does not return a path if it does not exist.', async(): Promise<void> => {
    store.hasResource.mockResolvedValueOnce(false);
    await expect(handler.handle({ selector: '/test', mappings })).resolves.toEqual([ ]);
  });

  it('returns all children if there is a single * at the end.', async(): Promise<void> => {
    setMetadata([ '/foo', '/bar/' ]);
    setMetadata([ '/bar/baz' ]);
    await expect(handler.handle({ selector: '/*', mappings })).resolves.toEqual([
      { path: '/foo' },
      { path: '/bar/' }
    ]);
    expect(store.getRepresentation).toHaveBeenCalledTimes(1);
    expect(store.getRepresentation).toHaveBeenNthCalledWith(1, { path: '/' }, {});
  });

  it('returns all matching children if there is a * in the middle.', async(): Promise<void> => {
    setMetadata([ '/foo', '/bar/', '/baz/' ]);
    await expect(handler.handle({ selector: '/*/baz', mappings })).resolves.toEqual([
      { path: '/bar/baz' },
      { path: '/baz/baz' }
    ]);
    expect(store.getRepresentation).toHaveBeenCalledTimes(1);
    expect(store.getRepresentation).toHaveBeenNthCalledWith(1, { path: '/' }, {});
  });

  it('can match * being part of a name for documents.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js/', '/foo.py', '/baz.js' ]);
    await expect(handler.handle({ selector: '/*.js', mappings })).resolves.toEqual([
      { path: '/foo.js' },
      { path: '/baz.js' }
    ]);
  });

  it('can match * being part of a name for containers.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js/', '/foo.py', '/bar.py/' ]);
    await expect(handler.handle({ selector: '/*.js/', mappings })).resolves.toEqual([
      { path: '/bar.js/' }
    ]);
  });

  it('can match * being part of a name in the middle of a path.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js/', '/foo.py', '/bar.py/' ]);
    await expect(handler.handle({ selector: '/*.js/baz', mappings })).resolves.toEqual([
      { path: '/bar.js/baz' }
    ]);
  });

  it('can match * being part of a name for documents with a prefix.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js', '/foo.py', '/bar.py' ]);
    await expect(handler.handle({ selector: '/f*.js', mappings })).resolves.toEqual([
      { path: '/foo.js' }
    ]);
  });

  it('can match ** being part of a name for documents.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js/', '/foo.py', '/baz.js' ]);
    await expect(handler.handle({ selector: '/**.js', mappings })).resolves.toEqual([
      { path: '/foo.js' },
      { path: '/baz.js' }
    ]);
  });

  it('can match ** being part of a name for containers.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js/', '/foo.py', '/bar.py/' ]);
    await expect(handler.handle({ selector: '/**.js/', mappings })).resolves.toEqual([
      { path: '/bar.js/' }
    ]);
  });

  it('can match ** being part of a name in the middle of a path.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js/', '/foo.py', '/bar.py/' ]);
    await expect(handler.handle({ selector: '/**.js/baz', mappings })).resolves.toEqual([
      { path: '/bar.js/baz' }
    ]);
  });

  it('can match ** being part of a name for documents with a prefix.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js', '/foo.py', '/bar.py' ]);
    await expect(handler.handle({ selector: '/f**.js', mappings })).resolves.toEqual([
      { path: '/foo.js' }
    ]);
  });

  it('supports ** at the end of a path.', async(): Promise<void> => {
    setMetadata([ '/foo', '/bar/', '/baz' ]);
    setMetadata([ '/bar/bazz' ]);
    await expect(handler.handle({ selector: '/**', mappings })).resolves.toEqual([
      { path: '/' },
      { path: '/foo' },
      { path: '/bar/' },
      { path: '/bar/bazz' },
      { path: '/baz' },
    ]);
  });

  it('supports ** in the middle of a path.', async(): Promise<void> => {
    setMetadata([ '/foo/bar', '/foo/baz/' ]);
    setMetadata([ '/foo/baz/bazd', '/foo/baz/bazc/' ]);
    await expect(handler.handle({ selector: '/foo/**/bar', mappings })).resolves.toEqual([
      { path: '/foo/bar' },
      { path: '/foo/baz/bar' },
      { path: '/foo/baz/bazc/bar' },
    ]);
  });
});
