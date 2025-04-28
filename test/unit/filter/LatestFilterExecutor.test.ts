import { text } from 'node:stream/consumers';
import {
  BasicRepresentation,
  DC,
  InternalServerError,
  NotFoundHttpError,
  NotImplementedHttpError,
  RepresentationMetadata,
} from '@solid/community-server';
import type { FilterExecutorInput } from '../../../src/filter/FilterExecutor';
import { LatestFilterExecutor } from '../../../src/filter/LatestFilterExecutor';
import { DERIVED_TYPES } from '../../../src/Vocabularies';

describe('A LatestFilterExecutor', (): void => {
  let input: FilterExecutorInput<string>;
  const executor = new LatestFilterExecutor();

  beforeEach(async(): Promise<void> => {
    input = {
      config: {
        identifier: { path: 'http://example.com/foo' },
        mappings: {},
        filter: 'latest',
        selectors: [],
        metadata: new RepresentationMetadata(),
      },
      filter: {
        type: DERIVED_TYPES.terms.String,
        data: 'latest',
        checksum: '',
        metadata: new RepresentationMetadata(),
      },
      representations: [ new BasicRepresentation() ],
    };
  });

  it('can only handle latest filter objects.', async(): Promise<void> => {
    await expect(executor.canHandle(input)).resolves.toBeUndefined();

    input.filter.type = DERIVED_TYPES.terms.Sparql;
    await expect(executor.canHandle(input)).rejects.toThrow(NotImplementedHttpError);

    input.filter.type = DERIVED_TYPES.terms.String;
    input.filter.data = 'wrong';
    await expect(executor.canHandle(input)).rejects.toThrow(NotImplementedHttpError);
  });

  it('errors if there are no matching representations.', async(): Promise<void> => {
    input.representations = [];
    await expect(executor.handle(input)).rejects.toThrow(NotFoundHttpError);
  });

  it('errors if some representations do not have a timestamp.', async(): Promise<void> => {
    await expect(executor.handle(input)).rejects.toThrow(InternalServerError);

    input.representations = [
      new BasicRepresentation('', new RepresentationMetadata({ [DC.modified]: new Date().toISOString() })),
      new BasicRepresentation(),
    ];
    await expect(executor.handle(input)).rejects.toThrow(InternalServerError);

    input.representations = [
      new BasicRepresentation('', new RepresentationMetadata({ [DC.modified]: new Date().toISOString() })),
      new BasicRepresentation('', new RepresentationMetadata({ [DC.modified]: new Date().toISOString() })),
    ];
    await expect(executor.handle(input)).resolves.toBeDefined();
  });

  it('returns the representation of the latest resource.', async(): Promise<void> => {
    input.representations = [
      new BasicRepresentation('1', new RepresentationMetadata({ [DC.modified]: new Date(1).toISOString() })),
      new BasicRepresentation('3', new RepresentationMetadata({ [DC.modified]: new Date(3).toISOString() })),
      new BasicRepresentation('2', new RepresentationMetadata({ [DC.modified]: new Date(2).toISOString() })),
    ];
    const result = input.representations[1];
    await expect(executor.handle(input)).resolves.toBe(result);
    await expect(text(result.data)).resolves.toBe('3');
  });
});
