import { HttpResponse } from 'msw';
import type { Note, NoteAbout, NoteRole } from '@/lib/notes/api';

/**
 * The shared customer notebook (S61), as Django keeps it: one list per user that the sales and
 * supervisor mocks both read and write (`api/core/notebook.py`). Each staff member is a name here.
 */
let books: Map<number, Note[]> | null = null;
let next = 900;

const hours = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();

function seed(user: number): Note[] {
  // عرفان ملکی (sales mock 105): a pinned team note and one moved in from the old sales page.
  if (user !== 105) return [];
  return [
    {
      id: 801,
      text: 'پدرش هزینه را می‌دهد. قبل از هر پیشنهاد با او هماهنگ کنید.',
      about: 'customer',
      role: 'manager',
      pinned: true,
      author: 'سمیرا احمدی',
      imported: null,
      created_at: hours(30),
      edited_at: null,
      mine: false,
    },
    {
      id: 800,
      text: 'به آلمان علاقه دارد، آیلتس ندارد.',
      about: 'customer',
      role: 'sales',
      pinned: false,
      author: null,
      imported: 'crm',
      created_at: hours(400),
      edited_at: null,
      mine: false,
    },
  ];
}

function book(user: number) {
  books ??= new Map();
  let notes = books.get(user);
  if (!notes) {
    notes = seed(user);
    books.set(user, notes);
  }
  return notes;
}

/** Pinned first, then newest; `mine` from the viewer's name. */
export function notebookOf(user: number, me: string) {
  const rows = book(user)
    .map((note) => ({ ...note, mine: note.author === me }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.id - a.id);
  return HttpResponse.json({ results: rows });
}

export async function addToNotebook(user: number, me: string, role: NoteRole, request: Request) {
  const body = (await request.json()) as { text?: string; about?: NoteAbout; pinned?: boolean };
  const text = body.text?.trim() ?? '';
  if (!text) return HttpResponse.json({ text: ['This field may not be blank.'] }, { status: 400 });
  const note: Note = {
    id: (next += 1),
    text,
    about: body.about ?? 'customer',
    role,
    pinned: body.pinned === true,
    author: me,
    imported: null,
    created_at: new Date().toISOString(),
    edited_at: null,
    mine: true,
  };
  book(user).push(note);
  return HttpResponse.json(note, { status: 201 });
}

export async function changeInNotebook(user: number, id: number, me: string, request: Request) {
  const note = book(user).find((item) => item.id === id);
  if (!note) return HttpResponse.json({ detail: 'Not found.' }, { status: 404 });
  const body = (await request.json()) as { text?: string; about?: NoteAbout; pinned?: boolean };
  if ((body.text !== undefined || body.about !== undefined) && note.author !== me)
    return HttpResponse.json(
      { detail: "Only the note's author changes its text." },
      { status: 403 },
    );
  if (body.pinned !== undefined) note.pinned = body.pinned;
  if (body.about !== undefined) note.about = body.about;
  if (body.text !== undefined && body.text.trim() !== note.text) {
    note.text = body.text.trim();
    note.edited_at = new Date().toISOString();
  }
  return HttpResponse.json({ ...note, mine: note.author === me });
}

/** Django moves a case's old single-text notes in the first time the notebook is read. */
export function importOldNotes(user: number, old: { supervisor: string; manager: string }) {
  const notes = book(user);
  for (const kind of ['supervisor', 'manager'] as const) {
    if (!old[kind].trim() || notes.some((note) => note.imported === kind)) continue;
    notes.push({
      id: (next += 1),
      text: old[kind].trim(),
      about: 'contract',
      role: kind,
      pinned: false,
      author: null,
      imported: kind,
      created_at: hours(200),
      edited_at: null,
      mine: false,
    });
  }
}

export function resetNotebookMocks() {
  books = null;
}
