import { INTERNAL_QUADS, NotImplementedHttpError, Representation } from '@solid/community-server';
import { Store } from 'n3';
import { once } from 'node:events';
import { FilterExecutor, FilterExecutorInput } from './FilterExecutor';
import { N3FilterExecutor } from './N3FilterExecutor';

/**
 * Converts the input quad streams into a single N3.js store and calls an {@link N3FilterExecutor}.
 */
export class RdfFilterExecutor extends FilterExecutor {
  protected readonly source: N3FilterExecutor;

  public constructor(source: N3FilterExecutor) {
    super();
    this.source = source;
  }

  public async canHandle(input: FilterExecutorInput): Promise<void> {
    const isRdf = input.representations.every((representation): boolean =>
      representation.metadata.contentType === INTERNAL_QUADS);

    if (!isRdf) {
      throw new NotImplementedHttpError('Only RDF input data is supported.');
    }

    return this.source.canHandle({
      ...input,
      data: new Store(),
    });
  }

  public async handle(input: FilterExecutorInput): Promise<Representation> {
    const data = new Store();
    const importPromises: Promise<unknown>[] = [];
    for (const representation of input.representations) {
      const emitter = data.import(representation.data);
      importPromises.push(once(emitter, 'end'));
    }
    await Promise.all(importPromises);

    return this.source.handle({
      ...input,
      data,
    });
  }
}
