# i18n — Internationalisation

The React app uses [react-i18next](https://react.i18next.com/) with [i18next](https://www.i18next.com/).

## Quick Start

```tsx
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation();
  return <button>{t('actions.save')}</button>;
}
```

## Adding a New Locale

1. Copy `locales/en.json` to `locales/<code>.json` (e.g. `fr.json`)
2. Translate all values in the new file — do not change the keys
3. Register the locale in `i18n/index.ts`:

```ts
import frLocale from './locales/fr.json';

i18n.init({
  resources: {
    en: { translation: enLocale },
    fr: { translation: frLocale },   // add this
  },
});
```

4. The browser language detector will automatically use the new locale for French-speaking users.

## Key Naming Convention

Use dot-separated namespacing in `component.element.action` format:

```
topbar.status.live           → "Live"
topbar.session.add           → "Add session"
agent.card.compactNow        → "compact now"
agent.status.running         → "Running"
nav.agents                   → "Agents"
actions.approve              → "Approve"
errors.failedToLoad          → "Failed to load"
```

Rules:
- First segment: component name (`topbar`, `agent`, `nav`, `actions`, `errors`)
- Second segment: element or sub-component (`status`, `card`, `stats`)
- Third segment: specific string (`live`, `compactNow`, `approve`)
- Use camelCase within each segment
- Plural forms use `_plural` suffix (i18next convention)

## Interpolation

Use `{{variable}}` for dynamic values:

```json
{ "agent.card.contextPct": "ctx {{pct}}%" }
```

```tsx
t('agent.card.contextPct', { pct: 75 })  // → "ctx 75%"
```

## Scope

The i18n pattern has been applied to:
- `Topbar.tsx` — status badge (Live/Local)
- `AgentCard.tsx` — compact warning, context percentage, select aria-label

Not yet wrapped (establish the pattern first, extend incrementally):
- `StatusBadge.tsx` — status labels
- `BottomNav.tsx` — navigation tab labels
- Other components

## Full Documentation

For full internationalisation documentation, see `docs/site/` (if the Docusaurus site has been built from M9-003).
