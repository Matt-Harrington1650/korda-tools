export const cn = (...values: Array<string | false | null | undefined>): string => {
  return values.filter((value): value is string => Boolean(value)).join(' ');
};

export const invariant = (condition: unknown, message: string): asserts condition => {
  if (!condition) {
    throw new Error(message);
  }
};
