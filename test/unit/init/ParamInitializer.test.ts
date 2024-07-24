import { ParamInitializer } from '../../../src/init/ParamInitializer';
import type { ParamSetter } from '../../../src/init/ParamSetter';

const exit = jest.spyOn(process, 'exit').mockImplementation(jest.fn() as any);

describe('ParamInitializer', (): void => {
  const param = 'param';
  let setter: jest.Mocked<ParamSetter<string>>;

  beforeEach(async(): Promise<void> => {
    setter = {
      setParam: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('sets the param.', async(): Promise<void> => {
    // eslint-disable-next-line no-new
    new ParamInitializer(setter, param);
    expect(setter.setParam).toHaveBeenLastCalledWith(param);
    expect(exit).toHaveBeenCalledTimes(0);
  });

  it('exits if there was an error.', async(): Promise<void> => {
    setter.setParam.mockRejectedValueOnce(new Error('bad data'));
    // eslint-disable-next-line no-new
    new ParamInitializer(setter, param);
    expect(setter.setParam).toHaveBeenLastCalledWith(param);
    await Promise.resolve('wait');
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
