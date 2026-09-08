export function resolveBackstageUrl(argv: string[] = process.argv): string {
  const flagIndex = argv.indexOf('--backstage-url');
  const url = flagIndex !== -1 ? argv[flagIndex + 1] : process.env.BACKSTAGE_URL;
  if (!url) {
    throw new Error('context-router-daemon: missing --backstage-url (or BACKSTAGE_URL env var)');
  }
  return url;
}
