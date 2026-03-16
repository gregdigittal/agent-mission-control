# Agent Mission Control — Documentation Site

Docusaurus 3 documentation site for Agent Mission Control.

## Local Development

```bash
# Install dependencies (first time only)
npm install

# Start dev server with live reload
npm start
# Open http://localhost:3000
```

## Build

```bash
npm run build
# Output: build/
```

## Serve Built Site

```bash
npm run serve
# Serves from build/ at http://localhost:3000
```

## Adding Documentation

1. Create a `.md` file in `docs/` (or a subdirectory)
2. Add frontmatter with `id`, `title`, and `sidebar_position`
3. Register the page in `sidebars.ts` (this site uses an explicit sidebar)

### Subdirectory pages

Pages in `docs/bridge/`, `docs/dashboard/`, etc. follow the same pattern. The `id` in frontmatter is the slug used in `sidebars.ts`.

## Adding a New Locale

1. Add the locale to `i18n.locales` in `docusaurus.config.ts`
2. Run `npm run write-translations -- --locale <code>` to generate translation keys
3. Translate files in `i18n/<code>/`

## CI Integration

TODO[agent-api]: add a docs-site job to `.github/workflows/ci.yml`:

```yaml
docs-site:
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: docs/site
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: npm
        cache-dependency-path: docs/site/package-lock.json
    - run: npm ci
    - run: npm run build
```
