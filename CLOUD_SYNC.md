# Cloud ↔ Local sync notes

**Source of truth:** `main` on https://github.com/aanimesh-mcgill/bioapp.git

## Latest local work (desktop)

Commit on `main` includes the full album book viewer, photo stories (name on save), multi-clip recording, contributor flows, bilingual UI, PDF/QR export, Firestore rules, cloud functions, and Hindi Devanagari transcription worker updates.

## Cursor Cloud branches (from phone / cloud agents)

These branches exist on `origin` and contain **additional** work not yet merged into `main`:

| Branch | Summary |
|--------|---------|
| `origin/cursor/book-collab-pdf-beb5` | Multi-book collaboration, invite links, audiobook/TTS public reader, photobook PDF (`photobookPdf.ts`), `BookContext`, `BooksPage`, etc. |
| `origin/cursor/create-cloud-run-1858` | Reusable Cloud Run deployment command |
| `origin/cursor/setup-dev-environment-6020` | Cursor Cloud dev environment docs |

## For Cursor Cloud agents

1. **Start from `main`** — it has the latest desktop session work.
2. **Do not overwrite** local album/contributor code; merge or cherry-pick from cloud branches where needed.
3. Cloud collaboration code is preserved in:
   - `apps/web/src/services/booksCollaboration.ts` (extracted from `cursor/book-collab-pdf-beb5`; uses `CollabBook` type to avoid clashing with album `Book` in `books.ts`)
   - Types: `CollabBook`, `BookInvitation`, etc. in `apps/web/src/types/index.ts`
4. To integrate cloud UI pages, merge `origin/cursor/book-collab-pdf-beb5` and resolve conflicts — prefer `main` for album viewer / contributor routes; bring in cloud-only pages (`BooksPage`, `InvitationLinkPage`, …) and wire imports to `booksCollaboration.ts`.

## Two book models (intentional until unified)

- **Album book** (`Book` in `types/index.ts`, `services/books.ts`) — chapters, stories, public slug `/read/:bookSlug`, album PDF.
- **Collab book** (`CollabBook`, `services/booksCollaboration.ts`) — multi-book switcher, email invites, token browse, audiobook carousel.

Unifying these is a follow-up task.
