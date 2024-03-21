import { BasicRepresentation, LDP, RepresentationMetadata, ResourceStore } from '@solid/community-server';
import { DerivationConfig } from '../../../src/DerivationConfig';
import { GlobSelectorParser } from '../../../src/selector/GlobSelectorParser';

describe('GlobSelectorHandler', (): void => {
  let store: jest.Mocked<ResourceStore>;
  let handler: GlobSelectorParser;
  let input: DerivationConfig;

  beforeEach(async(): Promise<void> => {
    input = {
      identifier: { path: 'http://example.com/foo' },
      mappings: {},
      selectors: [],
      filter: 'filter',
      metadata: new RepresentationMetadata(),
    };

    store = {
      hasResource: jest.fn().mockResolvedValue(true),
      getRepresentation: jest.fn().mockResolvedValue(new BasicRepresentation([], '')),
    } satisfies Partial<ResourceStore> as any;

    handler = new GlobSelectorParser(store);
  });

  function setMetadata(paths: string[]) {
    const metadata = new RepresentationMetadata();
    for (const path of paths) {
      metadata.add(LDP.terms.contains, path);
    }
    store.getRepresentation.mockResolvedValueOnce(new BasicRepresentation([], metadata));
  }

  it('returns the path itself if there is no glob.', async(): Promise<void> => {
    input.selectors = [ '/test' ];
    await expect(handler.handle(input)).resolves.toEqual([ { path: '/test' } ]);
  });

  it('does not return a path if it does not exist.', async(): Promise<void> => {
    store.hasResource.mockResolvedValueOnce(false);
    input.selectors = [ '/test' ];
    await expect(handler.handle(input)).resolves.toEqual([ ]);
  });

  it('returns all children if there is a single * at the end.', async(): Promise<void> => {
    setMetadata([ '/foo', '/bar/' ]);
    setMetadata([ '/bar/baz' ]);
    input.selectors = [ '/*' ];
    await expect(handler.handle(input)).resolves.toEqual([
      { path: '/foo' },
      { path: '/bar/' }
    ]);
    expect(store.getRepresentation).toHaveBeenCalledTimes(1);
    expect(store.getRepresentation).toHaveBeenNthCalledWith(1, { path: '/' }, {});
  });

  it('returns all matching children if there is a * in the middle.', async(): Promise<void> => {
    setMetadata([ '/foo', '/bar/', '/baz/' ]);
    input.selectors = [ '/*/baz' ];
    await expect(handler.handle(input)).resolves.toEqual([
      { path: '/bar/baz' },
      { path: '/baz/baz' }
    ]);
    expect(store.getRepresentation).toHaveBeenCalledTimes(1);
    expect(store.getRepresentation).toHaveBeenNthCalledWith(1, { path: '/' }, {});
  });

  it('can match * being part of a name for documents.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js/', '/foo.py', '/baz.js' ]);
    input.selectors = [ '/*.js' ];
    await expect(handler.handle(input)).resolves.toEqual([
      { path: '/foo.js' },
      { path: '/baz.js' }
    ]);
  });

  it('can match * being part of a name for containers.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js/', '/foo.py', '/bar.py/' ]);
    input.selectors = [ '/*.js/' ];
    await expect(handler.handle(input)).resolves.toEqual([
      { path: '/bar.js/' }
    ]);
  });

  it('can match * being part of a name in the middle of a path.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js/', '/foo.py', '/bar.py/' ]);
    input.selectors = [ '/*.js/baz' ];
    await expect(handler.handle(input)).resolves.toEqual([
      { path: '/bar.js/baz' }
    ]);
  });

  it('can match * being part of a name for documents with a prefix.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js', '/foo.py', '/bar.py' ]);
    input.selectors = [ '/f*.js' ];
    await expect(handler.handle(input)).resolves.toEqual([
      { path: '/foo.js' }
    ]);
  });

  it('can match ** being part of a name for documents.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js/', '/foo.py', '/baz.js' ]);
    input.selectors = [ '/**.js' ];
    await expect(handler.handle(input)).resolves.toEqual([
      { path: '/foo.js' },
      { path: '/baz.js' }
    ]);
  });

  it('can match ** being part of a name for containers.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js/', '/foo.py', '/bar.py/' ]);
    input.selectors = [ '/**.js/' ];
    await expect(handler.handle(input)).resolves.toEqual([
      { path: '/bar.js/' }
    ]);
  });

  it('can match ** being part of a name in the middle of a path.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js/', '/foo.py', '/bar.py/' ]);
    input.selectors = [ '/**.js/baz' ];
    await expect(handler.handle(input)).resolves.toEqual([
      { path: '/bar.js/baz' }
    ]);
  });

  it('can match ** being part of a name for documents with a prefix.', async(): Promise<void> => {
    setMetadata([ '/foo.js', '/bar.js', '/foo.py', '/bar.py' ]);
    input.selectors = [ '/f**.js' ];
    await expect(handler.handle(input)).resolves.toEqual([
      { path: '/foo.js' }
    ]);
  });

  it('supports ** at the end of a path.', async(): Promise<void> => {
    setMetadata([ '/foo', '/bar/', '/baz' ]);
    setMetadata([ '/bar/bazz' ]);
    input.selectors = [ '/**' ];
    await expect(handler.handle(input)).resolves.toEqual([
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
    input.selectors = [ '/foo/**/bar' ];
    await expect(handler.handle(input)).resolves.toEqual([
      { path: '/foo/bar' },
      { path: '/foo/baz/bar' },
      { path: '/foo/baz/bazc/bar' },
    ]);
  });
});
