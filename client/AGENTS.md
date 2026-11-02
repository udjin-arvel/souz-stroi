<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- The app is a thin browser client for an external FastAPI backend (`POST /api/generate`, `GET /api/health`); all generation logic lives in that backend, the client only validates input, calls the API and renders the response.
- Demo mode (`src/lib/mock.ts`) imitates the backend contract in the browser so the UI can be shown without a running backend; keep it in sync with the API contract in `src/lib/api.ts`.
- Backend URL comes from settings (localStorage) with `VITE_API_BASE_URL` as default, so the same build works against any backend address.
