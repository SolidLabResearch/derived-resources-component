/**
 * Interface to be used by classes that need certain parameters,
 * but can't receive them during constructor initialization for some reason.
 */
export interface ParamSetter<T> {
  /**
   * Assigns the parameter to the class.
   *
   * @param param - Parameter to assign.
   */
  setParam: (param: T) => Promise<void>;
}
