# E2E Tests — Agent Mission Control

## Projects

| Project | Specs | Target | Server |
|---------|-------|--------|--------|
| `dashboard-chromium` | `dashboard.spec.js` | MVP dashboard | `python3 -m http.server 8090` |
| `app-setup` | `global-setup.spec.ts` | Auth session setup | React dev server |
| `app-chromium` | `app-*.spec.ts` | React app (desktop) | React dev server |
| `app-mobile` | `app-*.spec.ts` | React app (mobile) | React dev server |

## Quick start

### MVP dashboard tests (already passing)
```bash
npx playwright test --project=dashboard-chromium
```

### React app tests (RED — require setup)

1. Start the React dev server:
   ```bash
   cd app && cp .env.example .env  # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
   npm run dev
   ```

2. Create a test user in your Supabase project (Auth → Users → Invite user).

3. Run auth setup (once):
   ```bash
   export E2E_TEST_EMAIL=test@yourdomain.com
   export E2E_TEST_PASSWORD=yourpassword
   npx playwright test --project=app-setup
   ```
   This creates `tests/e2e/.auth/user.json` (gitignored).

4. Run the app specs:
   ```bash
   npx playwright test --project=app-chromium
   npx playwright test --project=app-mobile
   ```

## Test state injection

Several tests call `window.__AMC_INJECT_*` helpers to push mock data into the
Zustand store without needing a live Supabase connection. These helpers must be
exposed by the app in dev/test mode. Add to `app/src/main.tsx`:

```typescript
if (import.meta.env.DEV) {
  const { useKanbanStore, useSessionStore, useCostStore } = await import('./stores');
  // @ts-ignore
  window.__AMC_INJECT_TASKS = (tasks) => useKanbanStore.getState().setTasks(tasks);
  // @ts-ignore
  window.__AMC_INJECT_EVENTS = (events) => useSessionStore.getState().setEvents(events);
  // @ts-ignore
  window.__AMC_INJECT_CONFLICTS = (files) => useSessionStore.getState().setConflictFiles(files);
  // @ts-ignore
  window.__AMC_INJECT_APPROVALS = (items) => useSessionStore.getState().setApprovals(items);
  // @ts-ignore
  window.__AMC_INJECT_COST = (cost) => useCostStore.getState().setCost(cost);
}
```

## CI

The `app-chromium` project is not yet in `ci.yml` — it requires Supabase secrets
to be configured as repo secrets. Add when ready:

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
- name: Run dashboard E2E
  run: npx playwright test --project=dashboard-chromium
- name: Run app E2E
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
    E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
    E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
  run: |
    cd app && npm run dev &
    npx playwright test --project=app-setup
    npx playwright test --project=app-chromium
```
