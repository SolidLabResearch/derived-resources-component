import type { Readable } from 'node:stream';
import { PassThrough } from 'node:stream';
import { InternalServerError, pipeSafely } from '@solid/community-server';

/**
 * Merge the contents of several streams into a single stream.
 *
 * @param streams - The input streams, either as an array or separate parameters.
 */
export function mergeStreams(...streams: Readable[] | [ Readable[] ]): Readable {
  let input = streams.length === 1 && Array.isArray(streams[0]) ? streams[0] : streams as Readable[];
  input = input.filter((stream): boolean => !stream.readableEnded);
  let count = input.length;
  const merged = new PassThrough({ objectMode: true });
  for (const stream of input) {
    stream.pipe(merged, { end: false });
    stream.on('error', (error): void => {
      merged.destroy(error);
    });
    stream.on('end', (): void => {
      count -= 1;
      if (count === 0) {
        merged.end();
      }
    });
  }
  return merged;
}

/**
 * Takes the first X elements of a stream.
 * Returns those elements, and the stream that should be used to read the remainder from.
 * A new stream is returned instead of letting the old one be reused
 * as it is not possible to reset a stream to its initial undefined reading state,
 * which would force the user into the reading mode we chose for this function.
 * https://nodejs.org/docs/latest-v18.x/api/stream.html#three-states
 *
 * The returned stream will be marked as ended if all the elements were read.
 *
 * Note that `stream.pick` exists, but does not allow you to read the remainder from the stream.
 *
 * @param stream - Stream to take elements from.
 * @param amount - How many elements to take.
 */
export async function take(stream: Readable, amount: number): Promise<{ head: unknown[]; tail: Readable }> {
  if (!stream.readableObjectMode) {
    throw new InternalServerError('Trying to split non-object mode stream');
  }

  if (stream.readableEnded) {
    return { head: [], tail: stream };
  }

  const head = await new Promise<unknown[]>((resolve, reject): void => {
    const result: unknown[] = [];
    function listener(data: unknown): void {
      result.push(data);
      if (result.length === amount) {
        stream.off('data', listener);
        stream.pause();
        resolve(result);
      }
    }
    stream.on('data', listener);
    stream.on('end', (): void => {
      resolve(result);
    });
    stream.on('error', (error): void => {
      reject(error);
    });
  });

  if (stream.readableEnded) {
    return { head, tail: stream };
  }

  const tail = new PassThrough({ objectMode: true });
  pipeSafely(stream, tail);
  stream.resume();
  return { head, tail };
}
