import { createErrorMessage, getLoggerFor, Initializer } from '@solid/community-server';
import { ParamSetter } from './ParamSetter';

/**
 * Assigns the value for a {@link ParamSetter}.
 * This assignment already happens in the constructor,
 * the actual handle call to this Initializer is irrelevant.
 */
export class ParamInitializer<T> extends Initializer {
  protected readonly logger = getLoggerFor(this);

  public constructor(paramSetter: ParamSetter<T> | ParamSetter<T>[], param: T) {
    super();
    if (!Array.isArray(paramSetter)) {
      paramSetter = [ paramSetter ];
    }
    for (const setter of paramSetter) {
      setter.setParam(param).catch(error => {
        this.logger.error(`Unable to set parameter: ${createErrorMessage(error)}`);
        process.exit(1);
      });
    }
  }

  public async handle(): Promise<void> {
    // Does nothing but we need the function.
    return;
  }
}
