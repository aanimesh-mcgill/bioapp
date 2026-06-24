import { useMemo, useState } from 'react';
import { useBook } from '@/context/BookContext';

export function BookSwitcher() {
  const { books, activeBook, loading, selectBook, createAndSelectBook } = useBook();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const sortedBooks = useMemo(
    () => [...books].sort((a, b) => a.title.localeCompare(b.title)),
    [books],
  );

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError('');
    try {
      await createAndSelectBook(title.trim(), description.trim());
      setTitle('');
      setDescription('');
      setShowCreate(false);
    } catch {
      setError('Could not create a new book. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="card mb-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Active book
          </p>
          <p className="text-sm text-slate-700">
            {loading ? 'Loading books…' : activeBook?.title ?? 'No book selected'}
          </p>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-brand-600"
          onClick={() => setShowCreate((prev) => !prev)}
        >
          {showCreate ? 'Cancel' : '+ New book'}
        </button>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Select book
        <select
          className="input-field mt-1"
          value={activeBook?.id ?? ''}
          disabled={loading || sortedBooks.length === 0}
          onChange={(event) => selectBook(event.target.value)}
        >
          {sortedBooks.map((book) => (
            <option key={book.id} value={book.id}>
              {book.title}
            </option>
          ))}
        </select>
      </label>

      {showCreate && (
        <form onSubmit={handleCreate} className="space-y-2 rounded-xl border border-slate-200 p-3">
          <input
            className="input-field"
            placeholder="Book title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            required
          />
          <textarea
            className="input-field min-h-[70px] resize-y"
            placeholder="Optional description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={300}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" type="submit" disabled={creating || !title.trim()}>
            {creating ? 'Creating…' : 'Create Book'}
          </button>
        </form>
      )}
    </div>
  );
}
