export async function consumeAsyncIterator(ai: AsyncIterable<unknown>) {
  try {
    for await (const _ of ai) {
      console.log("debug", _);
    }
  } catch (e) {
    console.error(e);
  }
}

export function raceYieldFromAsyncIterators<T extends AsyncIterator<unknown>[]>(
  ...iterators: T
): AsyncIterable<AsyncIteratorsType<T>, AsyncIteratorsErrors<T>> &
  AsyncIterator<AsyncIteratorsType<T>, AsyncIteratorsErrors<T>> & {
    get results(): AsyncIteratorsErrors<T>;
  } {
  const controllers = iterators.map(createAsyncIteratorController);

  const iterator: AsyncIterator<
    AsyncIteratorsType<T>,
    AsyncIteratorsErrors<T>
  > = {
    async next(): Promise<
      IteratorResult<AsyncIteratorsType<T>, AsyncIteratorsErrors<T>>
    > {
      const promises = controllers
        .filter((controller) => !controller.done)
        .map((controller) => controller.next);

      if (promises.length === 0) {
        return {
          done: true,
          value: controllers.map(
            (controller) => controller.error,
          ) as AsyncIteratorsErrors<T>,
        };
      } else {
        const result = await Promise.race(promises);

        if (result.done) {
          return iterator.next();
        }

        result.consume?.();

        delete result.consume;

        return result as never;
      }
    },
  };

  return {
    next: iterator.next,
    [Symbol.asyncIterator]: () => iterator,
    get results() {
      if (controllers.some((controller) => !controller.done)) {
        throw new Error("Not all async iterators are drained yet.");
      }

      return controllers.map((controller) => controller.error) as never;
    },
  };
}

function createAsyncIteratorController<T>(ai: AsyncIterator<T>) {
  const state = {
    done: false,
    error: undefined,
    next: ai.next().then(handleNext, handleError),
  } as {
    done: boolean;
    error: { error: unknown } | undefined;
    next: Promise<InternalIteratorResult<T>>;
  };
  return state;

  function handleNext(res: IteratorResult<T>): InternalIteratorResult<T> {
    if (res.done) {
      state.done = true;
    }
    return {
      ...res,
      consume() {
        state.next = ai.next().then(handleNext, handleError);
      },
    };
  }

  function handleError(error: unknown): InternalIteratorResult<T> {
    state.error = { error };
    state.done = true;
    return { done: true, value: undefined as never };
  }
}

type InternalIteratorResult<T, R = any> = IteratorResult<T, R> & {
  consume?(): void;
};

type AsyncIteratorType<T extends AsyncIterator<unknown>> =
  T extends AsyncIterator<infer O> ? O : never;
type AsyncIteratorsType<T extends AsyncIterator<unknown>[]> = T extends [
  infer T0 extends AsyncIterator<unknown>,
]
  ? AsyncIteratorType<T0>
  : T extends [
        infer T0 extends AsyncIterator<unknown>,
        ...infer Rest extends AsyncIterator<unknown>[],
      ]
    ? AsyncIteratorType<T0> | AsyncIteratorsType<Rest>
    : never;
type AsyncIteratorsErrors<T extends AsyncIterator<unknown>[]> = T extends [
  AsyncIterator<unknown>,
]
  ? [{ error: unknown } | undefined]
  : T extends [
        AsyncIterator<unknown>,
        ...infer Rest extends AsyncIterator<unknown>[],
      ]
    ? [{ error: unknown } | undefined, ...AsyncIteratorsErrors<Rest>]
    : [];
