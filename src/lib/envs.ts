export function extractEnvs(
  env: Record<string, string | undefined>,
  regexp: RegExp,
) {
  return Object.fromEntries(
    Object.entries(env)
      .filter(([name]) => regexp.test(name))
      .filter((entry): entry is [string, string] => entry[1] != null),
  );
}
