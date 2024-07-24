import { NotImplementedHttpError, RepresentationMetadata } from '@solid/community-server';
import type { FilterExecutor, FilterExecutorInput } from '../../../src/filter/FilterExecutor';
import { MappingFilterExecutor } from '../../../src/filter/MappingFilterExecutor';

describe('MappingFilterExecutor', (): void => {
  const representation = 'representation';
  let input: FilterExecutorInput<string>;
  let source: jest.Mocked<FilterExecutor>;
  let executor: MappingFilterExecutor;

  beforeEach(async(): Promise<void> => {
    input = {
      filter: {
        data: 'string with $var$ in it',
        metadata: new RepresentationMetadata(),
      },
      config: {
        identifier: { path: 'https://example.com' },
        mappings: { var: 'value', other: 'unused' },
        selectors: [ 'selector' ],
        filter: 'filter',
        metadata: new RepresentationMetadata(),
      },
      representations: [],
    };

    source = {
      canHandle: jest.fn(),
      handle: jest.fn().mockResolvedValue(representation),
    } satisfies Partial<FilterExecutor> as any;

    executor = new MappingFilterExecutor(source);
  });

  it('rejects non-string filters.', async(): Promise<void> => {
    (input as unknown as FilterExecutorInput<object>).filter.data = {};
    await expect(executor.canHandle(input)).rejects.toThrow(NotImplementedHttpError);
  });

  it('can handle input if its source can handle it.', async(): Promise<void> => {
    await expect(executor.canHandle(input)).resolves.toBeUndefined();

    const error = new Error('bad data');
    source.canHandle.mockRejectedValueOnce(error);
    await expect(executor.canHandle(input)).rejects.toThrow(error);
  });

  it('applies mappings to the filter.', async(): Promise<void> => {
    await expect(executor.handle(input)).resolves.toBe(representation);
    expect(source.handle).toHaveBeenLastCalledWith({
      ...input,
      filter: {
        ...input.filter,
        data: 'string with value in it',
      },
    });
  });
});
