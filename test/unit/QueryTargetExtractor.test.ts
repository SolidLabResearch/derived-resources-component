import type { HttpRequest, TargetExtractor } from '@solid/community-server';
import { QueryTargetExtractor } from '../../src/QueryTargetExtractor';

describe('QueryTargetExtractor', (): void => {
  const url = 'http://example.com/?a=b&c=d';
  const input: { request: HttpRequest } = { request: { url } as HttpRequest };
  let source: jest.Mocked<TargetExtractor>;
  let extractor: QueryTargetExtractor;

  beforeEach(async(): Promise<void> => {
    source = {
      canHandle: jest.fn(),
      handle: jest.fn().mockResolvedValue({ path: 'http://example.com' }),
    } satisfies Partial<QueryTargetExtractor> as any;

    extractor = new QueryTargetExtractor(source);
  });

  it('can handle input its source can handle.', async(): Promise<void> => {
    await expect(extractor.canHandle(input)).resolves.toBeUndefined();
    expect(source.canHandle).toHaveBeenCalledTimes(1);
    expect(source.canHandle).toHaveBeenLastCalledWith(input);

    const error = new Error('bad data');
    source.canHandle.mockRejectedValueOnce(error);
    await expect(extractor.canHandle(input)).rejects.toThrow(error);
  });

  it('adds the query parameters to the resource identifier.', async(): Promise<void> => {
    await expect(extractor.handle(input)).resolves.toEqual({
      path: 'http://example.com',
      query: {
        a: 'b',
        c: 'd',
      },
    });
    expect(source.handle).toHaveBeenCalledTimes(1);
    expect(source.handle).toHaveBeenLastCalledWith(input);
  });
});
