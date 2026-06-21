// ============================================================
// Data access layer. All Supabase reads/writes live here so the
// React components stay declarative. RLS enforces ownership.
// ============================================================
import { supabase } from "./supabase.js";

const BOOK_COLS =
  "id,user_id,title,authors,isbn13,isbn10,published,publisher,language,cover_url,status,rating,tags,notes,reading_notes,loan_status,loan_party,date_started,date_finished,sort_order,added_at";

// ---------------- Profile ----------------
export async function getMyProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return null;
  let { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    // Self-heal: create a profile if the signup trigger didn't.
    const display = (u.user.email || "").split("@")[0];
    const ins = await supabase
      .from("profiles")
      .insert({ id: u.user.id, display_name: display })
      .select()
      .single();
    if (ins.error) throw ins.error;
    data = ins.data;
  }
  return data;
}

export async function updateProfile(patch) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", u.user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------- Books ----------------
export async function listBooks() {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("books")
    .select(BOOK_COLS)
    .eq("user_id", u.user.id)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addBook(book) {
  const { data: u } = await supabase.auth.getUser();
  // dedupe by ISBN within this user's library
  if (book.isbn13 || book.isbn10) {
    const existing = await findBookByIsbn(book.isbn13, book.isbn10);
    if (existing) return { book: existing, created: false };
  }
  const max = await maxSortOrder();
  const row = {
    user_id: u.user.id,
    title: book.title || "Untitled",
    authors: book.authors || "",
    isbn13: book.isbn13 || "",
    isbn10: book.isbn10 || "",
    published: book.published || "",
    publisher: book.publisher || "",
    language: book.language || "",
    cover_url: book.cover_url || null,
    status: book.status || "to_read",
    rating: book.rating || 0,
    tags: book.tags || [],
    notes: book.notes || "",
    reading_notes: book.reading_notes || "",
    loan_status: book.loan_status || "none",
    loan_party: book.loan_party || "",
    date_started: book.date_started || null,
    date_finished: book.date_finished || null,
    sort_order: typeof book.sort_order === "number" ? book.sort_order : max + 1,
  };
  const { data, error } = await supabase.from("books").insert(row).select(BOOK_COLS).single();
  if (error) throw error;
  return { book: data, created: true };
}

export async function updateBook(id, patch) {
  const { data, error } = await supabase
    .from("books")
    .update(patch)
    .eq("id", id)
    .select(BOOK_COLS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBook(id) {
  const { error } = await supabase.from("books").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderBooks(orderedIds) {
  // Persist new sort_order for the affected books.
  const updates = orderedIds.map((id, i) =>
    supabase.from("books").update({ sort_order: i }).eq("id", id)
  );
  await Promise.all(updates);
}

async function findBookByIsbn(isbn13, isbn10) {
  const ors = [];
  if (isbn13) ors.push(`isbn13.eq.${isbn13}`);
  if (isbn10) ors.push(`isbn10.eq.${isbn10}`);
  if (!ors.length) return null;
  const { data: u } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("books")
    .select(BOOK_COLS)
    .eq("user_id", u.user.id)
    .or(ors.join(","))
    .limit(1);
  return (data && data[0]) || null;
}

async function maxSortOrder() {
  const { data: u } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("books")
    .select("sort_order")
    .eq("user_id", u.user.id)
    .order("sort_order", { ascending: false })
    .limit(1);
  return data && data[0] ? data[0].sort_order : 0;
}

// ---------------- Cover upload (Supabase Storage) ----------------
export async function uploadCover(bookId, blob, ext = "webp") {
  const { data: u } = await supabase.auth.getUser();
  const path = `${u.user.id}/${bookId}.${ext}`;
  const contentType = ext === "webp" ? "image/webp" : "image/jpeg";
  const { error } = await supabase.storage
    .from("covers")
    .upload(path, blob, { upsert: true, contentType, cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("covers").getPublicUrl(path);
  // Cache-bust so a re-upload to the same path shows immediately.
  return `${data.publicUrl}?t=${Date.now()}`;
}

// ---------------- Shelves ----------------
export async function listShelves() {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("shelves")
    .select("*")
    .eq("user_id", u.user.id)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addShelf(name) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("shelves")
    .insert({ user_id: u.user.id, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateShelf(id, patch) {
  const { data, error } = await supabase.from("shelves").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteShelf(id) {
  const { error } = await supabase.from("shelves").delete().eq("id", id);
  if (error) throw error;
}

// ---------------- Shelf membership ----------------
export async function listShelfBooks() {
  // Only rows on the current user's own shelves (inner-join filter on shelves.user_id).
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("shelf_books")
    .select("shelf_id,book_id,position,shelves!inner(user_id)")
    .eq("shelves.user_id", u.user.id);
  if (error) throw error;
  return data || [];
}

export async function addBooksToShelf(shelfId, bookIds) {
  // Add many books to one shelf without disturbing their other memberships.
  if (!bookIds.length) return;
  const rows = bookIds.map((book_id) => ({ shelf_id: shelfId, book_id }));
  const { error } = await supabase
    .from("shelf_books")
    .upsert(rows, { onConflict: "shelf_id,book_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function setBookShelves(bookId, shelfIds) {
  // Replace the set of shelves a book belongs to.
  const { error: delErr } = await supabase.from("shelf_books").delete().eq("book_id", bookId);
  if (delErr) throw delErr;
  if (shelfIds.length) {
    const rows = shelfIds.map((shelf_id) => ({ shelf_id, book_id: bookId }));
    const { error } = await supabase.from("shelf_books").insert(rows);
    if (error) throw error;
  }
}

// ---------------- Full backup / restore (JSON) ----------------
const BACKUP_BOOK_FIELDS = [
  "title", "authors", "isbn13", "isbn10", "published", "publisher", "language", "cover_url",
  "status", "rating", "tags", "notes", "reading_notes", "loan_status", "loan_party",
  "date_started", "date_finished", "sort_order",
];

export async function exportBackup() {
  const [profile, books, shelves, shelfBooks] = await Promise.all([
    getMyProfile(), listBooks(), listShelves(), listShelfBooks(),
  ]);
  const idToIdx = new Map(books.map((b, i) => [b.id, i]));
  return {
    app: "Ex Libris",
    version: 1,
    exported_at: new Date().toISOString(),
    profile: { display_name: profile?.display_name || "", library_public: !!profile?.library_public },
    books: books.map((b) => {
      const o = {};
      BACKUP_BOOK_FIELDS.forEach((f) => (o[f] = b[f] ?? (f === "tags" ? [] : f === "rating" || f === "sort_order" ? 0 : "")));
      return o;
    }),
    shelves: shelves.map((s) => ({
      name: s.name,
      is_public: !!s.is_public,
      book_idx: shelfBooks
        .filter((sb) => sb.shelf_id === s.id)
        .map((sb) => idToIdx.get(sb.book_id))
        .filter((i) => i != null),
    })),
  };
}

// Non-destructive restore: books are matched by ISBN (existing ones are kept),
// shelves are matched/created by name, and memberships are re-linked.
export async function importBackup(data) {
  if (!data || !Array.isArray(data.books)) throw new Error("Not a valid Ex Libris backup");
  const newIds = [];
  for (const b of data.books) {
    try {
      const { book } = await addBook(b);
      newIds.push(book.id);
    } catch (e) {
      console.error("import book failed", e);
      newIds.push(null);
    }
  }
  const existing = await listShelves();
  const byName = new Map(existing.map((s) => [s.name.toLowerCase(), s.id]));
  let shelfCount = 0;
  for (const s of data.shelves || []) {
    if (!s.name) continue;
    let shelfId = byName.get(s.name.toLowerCase());
    if (!shelfId) {
      const created = await addShelf(s.name);
      shelfId = created.id;
      byName.set(s.name.toLowerCase(), shelfId);
      shelfCount++;
    }
    const ids = (s.book_idx || []).map((i) => newIds[i]).filter(Boolean);
    if (ids.length) await addBooksToShelf(shelfId, ids);
  }
  return { books: newIds.filter(Boolean).length, shelves: shelfCount };
}

// ---------------- Public (anon) reads for share pages ----------------
export async function getPublicLibrary(slug) {
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id,display_name,library_public,library_slug")
    .eq("library_slug", slug)
    .eq("library_public", true)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!profile) return null;
  const { data: books, error: bErr } = await supabase
    .from("books")
    .select(BOOK_COLS)
    .eq("user_id", profile.id)
    .order("sort_order", { ascending: true });
  if (bErr) throw bErr;
  return { profile, books: books || [] };
}

export async function getPublicShelf(slug) {
  const { data: shelf, error: sErr } = await supabase
    .from("shelves")
    .select("id,name,user_id,is_public,share_slug")
    .eq("share_slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (sErr) throw sErr;
  if (!shelf) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", shelf.user_id)
    .maybeSingle();
  const { data: links, error: lErr } = await supabase
    .from("shelf_books")
    .select("book_id,position")
    .eq("shelf_id", shelf.id);
  if (lErr) throw lErr;
  const ids = (links || []).map((l) => l.book_id);
  let books = [];
  if (ids.length) {
    const { data, error } = await supabase.from("books").select(BOOK_COLS).in("id", ids);
    if (error) throw error;
    books = data || [];
  }
  return { shelf, owner: profile?.display_name || "A reader", books };
}
