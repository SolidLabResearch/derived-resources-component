import type { Representation } from '@solid/community-server';
import { DC, InternalServerError, NotFoundHttpError, NotImplementedHttpError } from '@solid/community-server';
import { DERIVED_TYPES } from '../Vocabularies';
import type { FilterExecutorInput } from './FilterExecutor';
import { FilterExecutor } from './FilterExecutor';

// TODO:
export class LatestFilterExecutor extends FilterExecutor {
  public async canHandle({ filter }: FilterExecutorInput): Promise<void> {
    if (!filter.type.equals(DERIVED_TYPES.terms.String) || filter.data !== 'latest') {
      throw new NotImplementedHttpError('Only "latest" literals are supported.');
    }
  }

  public async handle(input: FilterExecutorInput): Promise<Representation> {
    if (input.representations.length === 0) {
      throw new NotFoundHttpError();
    }

    let latest = input.representations[0];
    let lastDate = new Date(0);
    for (const representation of input.representations) {
      const dateTerm = representation.metadata.get(DC.terms.modified);
      if (!dateTerm) {
        throw new InternalServerError(`Missing timestamps in data when using "latest" filter.`);
      }
      const date = new Date(dateTerm.value);
      if (date > lastDate) {
        latest = representation;
        lastDate = date;
      }
    }
    return latest;
  }
}
