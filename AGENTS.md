# Project Guidelines

## Scope
- This repo's runnable application lives in `chatbot-ui/`; most code changes should happen there.
- Use `README.md` and `chatbot-ui/README.md` for deeper product and deployment context instead of duplicating that detail here.

## Architecture
- `chatbot-ui/src/App.jsx` is the stateful entrypoint for auth, sessions, chat, knowledge, theme, and view switching.
- `chatbot-ui/src/components/App/App.jsx` is the layout shell. Keep presentation concerns there and keep orchestration in `src/App.jsx` or `src/service/*`.
- All backend access should go through `chatbot-ui/src/service/{apiClient,authApi,chatApi,knowledgeApi}.js`. Reuse `apiClient` for the `/api/v1` prefix, auth token storage, refresh-token retry, and request defaults.
- Keep chat model catalogs, availability flags, and thinking-effort behavior in `chatbot-ui/src/config/uiConfig.js`. If model ids or labels change, update UI and tests together.
- Preserve `data-testid` selectors on interactive UI. Playwright smoke tests depend on them.

## Build and Test
- `cd chatbot-ui && npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test:e2e -- tests/e2e`
- Playwright starts the Vite dev server and mocks API traffic in the browser layer via `tests/e2e/support/mockApi*`. Extend the mocks when changing auth, chat, or knowledge flows.

## Conventions
- Configure backend URLs through `VITE_API_BASE_URL`; do not hardcode API hosts outside `chatbot-ui/src/service/apiClient.js`.
- Keep auth persistence on the existing `dominic.*` localStorage keys unless you are intentionally migrating stored session data.
- When changing session management, chat import flows, web-search toggles, or model selection behavior, update the matching Playwright coverage in `chatbot-ui/tests/e2e/`.
- Follow the current styling split: CSS Modules for component-local styles, `src/styles/variables.css` and `src/styles/globals.css` for shared tokens and global rules.