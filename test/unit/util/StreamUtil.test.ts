import { Readable } from 'node:stream';
import { mergeStreams, take } from '../../../src/util/StreamUtil';

describe('StreamUtil', (): void => {
  describe('#mergeStreams', (): void => {
    it('combines the contents of multiple streams.', async(): Promise<void> => {
      const stream1 = Readable.from([ 1, 2, 3 ]);
      const stream2 = Readable.from([ 4, 5, 6 ]);
      const stream3 = Readable.from([ 7, 8, 9 ]);
      const result = mergeStreams(stream1, stream2, stream3);
      const array = await result.toArray();
      // eslint-disable-next-line ts/require-array-sort-compare
      array.sort();
      expect(array).toEqual([ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
    });

    it('can take an array of streams as input.', async(): Promise<void> => {
      const stream1 = Readable.from([ 1, 2, 3 ]);
      const stream2 = Readable.from([ 4, 5, 6 ]);
      const stream3 = Readable.from([ 7, 8, 9 ]);
      const result = mergeStreams([ stream1, stream2, stream3 ]);
      const array = await result.toArray();
      // eslint-disable-next-line ts/require-array-sort-compare
      array.sort();
      expect(array).toEqual([ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]);
    });

    it('can handle streams that have already ended.', async(): Promise<void> => {
      const stream1 = Readable.from([ 1, 2, 3 ]);
      const stream2 = Readable.from([ 4, 5, 6 ]);
      const stream3 = Readable.from([ 7, 8, 9 ]);
      await stream2.toArray();
      expect(stream2.readableEnded).toBe(true);
      const result = mergeStreams([ stream1, stream2, stream3 ]);
      const array = await result.toArray();
      // eslint-disable-next-line ts/require-array-sort-compare
      array.sort();
      expect(array).toEqual([ 1, 2, 3, 7, 8, 9 ]);
    });

    it('errors if one of the input streams error.', async(): Promise<void> => {
      const stream1 = Readable.from([ 1, 2, 3 ]);
      const stream2 = Readable.from([ 4, 5, 6 ]);
      const stream3 = Readable.from([ 7, 8, 9 ]);
      const result = mergeStreams([ stream1, stream2, stream3 ]);
      stream2.destroy(new Error('bad data'));
      await expect(result.toArray()).rejects.toThrow('bad data');
    });
  });
  describe('#take', (): void => {
    it('returns the first elements of a stream.', async(): Promise<void> => {
      const stream = Readable.from([ 1, 2, 3, 4, 5 ]);
      const { head, tail } = await take(stream, 3);
      expect(head).toEqual([ 1, 2, 3 ]);
      expect(tail.readableEnded).toBe(false);
      await expect(tail.toArray()).resolves.toEqual([ 4, 5 ]);
    });

    it('returns an ended stream if all elements were taken.', async(): Promise<void> => {
      const stream = Readable.from([ 1, 2, 3, 4, 5 ]);
      const { head, tail } = await take(stream, 5);
      expect(head).toEqual([ 1, 2, 3, 4, 5 ]);
      expect(tail.readableEnded).toBe(true);
    });

    it('takes the max amount of elements if the request amount is higher than the size.', async(): Promise<void> => {
      const stream = Readable.from([ 1, 2, 3, 4, 5 ]);
      const { head, tail } = await take(stream, 50);
      expect(head).toEqual([ 1, 2, 3, 4, 5 ]);
      expect(tail.readableEnded).toBe(true);
    });

    it('returns empty results if the stream already ended.', async(): Promise<void> => {
      const stream = Readable.from([ 1, 2, 3, 4, 5 ]);
      await stream.toArray();
      expect(stream.readableEnded).toBe(true);
      const { head, tail } = await take(stream, 5);
      expect(head).toEqual([]);
      expect(tail.readableEnded).toBe(true);
    });

    it('errors if the input stream errors.', async(): Promise<void> => {
      const stream = Readable.from([ 1, 2, 3, 4, 5 ]);
      stream.destroy(new Error('bad data'));
      await expect(take(stream, 3)).rejects.toThrow('bad data');
    });
  });
});
