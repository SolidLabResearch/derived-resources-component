import type { Representation } from '@solid/community-server';
import { BasicRepresentation, DC, RepresentationMetadata } from '@solid/community-server';
import { BaseFilterHandler } from '../../../src/filter/BaseFilterHandler';
import type { Filter } from '../../../src/filter/Filter';
import type { FilterExecutor } from '../../../src/filter/FilterExecutor';
import type { FilterHandlerInput } from '../../../src/filter/FilterHandler';
import type { FilterParser } from '../../../src/filter/parser/FilterParser';
import { DERIVED } from '../../../src/Vocabularies';

describe('BaseFilterHandler', (): void => {
  let parser: jest.Mocked<FilterParser>;
  let executor: jest.Mocked<FilterExecutor>;
  let handler: BaseFilterHandler;
  let representation: Representation;
  const date1 = new Date(1988, 2, 9);
  const date2 = new Date(2020, 1, 14);
  const filter: Filter = {
    data: 'data',
    metadata: new RepresentationMetadata(),
  };
  let input: FilterHandlerInput;

  beforeEach(async(): Promise<void> => {
    input = {
      config: {
        identifier: { path: 'https://example.com' },
        mappings: {},
        selectors: [ 'selector' ],
        filter: 'filter',
        metadata: new RepresentationMetadata(),
      },
      representations: [
        new BasicRepresentation('', new RepresentationMetadata({ [DC.modified]: date1.toISOString() })),
        new BasicRepresentation('', new RepresentationMetadata({ [DC.modified]: date2.toISOString() })),
      ],
    };

    parser = {
      canHandle: jest.fn(),
      handle: jest.fn().mockResolvedValue(filter),
    } satisfies Partial<FilterParser> as any;

    representation = new BasicRepresentation();
    executor = {
      handleSafe: jest.fn().mockResolvedValue(representation),
    } satisfies Partial<FilterExecutor> as any;

    handler = new BaseFilterHandler(parser, executor);
  });

  it('can handle input the parser can handle.', async(): Promise<void> => {
    await expect(handler.canHandle(input)).resolves.toBeUndefined();
    expect(parser.canHandle).toHaveBeenLastCalledWith(input.config);

    const error = new Error('bad data');
    parser.canHandle.mockRejectedValueOnce(error);
    await expect(handler.canHandle(input)).rejects.toThrow(error);
  });

  it('adds the config metadata to the resulting representation.', async(): Promise<void> => {
    input.config.metadata.add(DERIVED.terms.template, 'foo');
    input.config.metadata.add(DERIVED.terms.selector, 'selector');
    input.config.metadata.add(DERIVED.terms.filter, 'filter');

    const result = await handler.handle(input);
    expect(result).toBe(representation);
    expect(result.metadata.get(DERIVED.terms.selector)?.value).toBe('selector');
    expect(result.metadata.get(DERIVED.terms.filter)?.value).toBe('filter');
    expect(executor.handleSafe).toHaveBeenLastCalledWith({ ...input, filter });
  });
});
