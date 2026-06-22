// ============================================================
// Framework-agnostic book helpers: languages, API lookups,
// CSV import/export. No React, no Supabase — pure functions.
// ============================================================

export const LANGS = [
  { code: "en", name: "English", alt: ["eng"] },
  { code: "es", name: "Spanish", alt: ["spa"] },
  { code: "fr", name: "French", alt: ["fre", "fra"] },
  { code: "de", name: "German", alt: ["ger", "deu"] },
  { code: "it", name: "Italian", alt: ["ita"] },
  { code: "pt", name: "Portuguese", alt: ["por"] },
  { code: "nl", name: "Dutch", alt: ["dut", "nld"] },
  { code: "ru", name: "Russian", alt: ["rus"] },
  { code: "ja", name: "Japanese", alt: ["jpn"] },
  { code: "zh", name: "Chinese", alt: ["chi", "zho"] },
  { code: "ko", name: "Korean", alt: ["kor"] },
  { code: "ar", name: "Arabic", alt: ["ara"] },
  { code: "hi", name: "Hindi", alt: ["hin"] },
  { code: "la", name: "Latin", alt: ["lat"] },
  { code: "el", name: "Greek", alt: ["gre", "grc", "ell"] },
  { code: "sv", name: "Swedish", alt: ["swe"] },
  { code: "pl", name: "Polish", alt: ["pol"] },
  { code: "tr", name: "Turkish", alt: ["tur"] },
  { code: "ca", name: "Catalan", alt: ["cat"] },
  { code: "da", name: "Danish", alt: ["dan"] },
];

export function langName(raw) {
  if (!raw) return "";
  const s = String(raw).toLowerCase().replace("/languages/", "").trim();
  for (const l of LANGS) {
    if (l.code === s || l.name.toLowerCase() === s || l.alt.includes(s)) return l.name;
  }
  return raw.length <= 3 ? raw.toUpperCase() : raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function langCode(name) {
  const l = LANGS.find((l) => l.name === name);
  return l ? l.code.toUpperCase() : name ? String(name).slice(0, 3).toUpperCase() : "";
}

export function yearOf(p) {
  if (!p) return "";
  const m = String(p).match(/\d{4}/);
  return m ? m[0] : "";
}

export const STATUSES = [
  { k: "to_read", label: "To read", c: "#7a2e2e" },
  { k: "reading", label: "Reading", c: "#b9824f" },
  { k: "read", label: "Read", c: "#6b7c3f" },
  { k: "recommended", label: "Recommended", c: "#8a6db0" },
];
export const statusColor = (k) => (STATUSES.find((s) => s.k === k) || STATUSES[0]).c;
export const statusLabel = (k) => (STATUSES.find((s) => s.k === k) || STATUSES[0]).label;

// Loan tracking: borrowed (incoming) vs lent (outgoing), with at-a-glance cues.
export const LOANS = {
  borrowed: { label: "Borrowed", short: "BORROWED", color: "#2e6f8e", icon: "↙" },
  lent: { label: "Lent out", short: "LENT", color: "#c2562a", icon: "↗" },
};
export const isOnLoan = (b) => b && b.loan_status && b.loan_status !== "none";

// Last name of the first listed author, for spine labels. Best-effort.
export function authorLastName(authors) {
  if (!authors) return "";
  const first = String(authors).split(",")[0].trim();
  if (!first) return "";
  const parts = first.split(/\s+/);
  return parts[parts.length - 1];
}

export function coverUrl(b) {
  if (!b) return null;
  if (b.cover_url) return b.cover_url;
  if (b.isbn13) return `https://covers.openlibrary.org/b/isbn/${b.isbn13}-M.jpg?default=false`;
  if (b.isbn10) return `https://covers.openlibrary.org/b/isbn/${b.isbn10}-M.jpg?default=false`;
  return null;
}

// ---------------- Open Library / Google Books ----------------
export async function fetchOpenLibISBN(isbn) {
  const r = await fetch(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!r.ok) return null;
  const d = await r.json();
  let authors = "";
  if (d.authors && d.authors.length) {
    const names = await Promise.all(
      d.authors.slice(0, 3).map(async (a) => {
        try {
          const ar = await fetch(`https://openlibrary.org${a.key}.json`);
          const aj = await ar.json();
          return aj.name;
        } catch {
          return null;
        }
      })
    );
    authors = names.filter(Boolean).join(", ");
  }
  const isbn13 = (d.isbn_13 && d.isbn_13[0]) || (isbn.length === 13 ? isbn : "");
  const isbn10 = (d.isbn_10 && d.isbn_10[0]) || (isbn.length === 10 ? isbn : "");
  const language = d.languages && d.languages[0] ? langName(d.languages[0].key) : "";
  return {
    title: d.title || "Untitled",
    authors,
    isbn13,
    isbn10,
    language,
    published: d.publish_date || "",
    publisher: (d.publishers && d.publishers[0]) || "",
    cover_url:
      d.covers && d.covers[0] ? `https://covers.openlibrary.org/b/id/${d.covers[0]}-L.jpg` : null,
  };
}

export async function fetchGoogleISBN(isbn) {
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  if (!r.ok) return null;
  const d = await r.json();
  if (!d.items || !d.items.length) return null;
  const v = d.items[0].volumeInfo;
  return {
    title: v.title || "Untitled",
    authors: (v.authors || []).join(", "),
    isbn13: isbn.length === 13 ? isbn : "",
    isbn10: isbn.length === 10 ? isbn : "",
    language: langName(v.language || ""),
    published: v.publishedDate || "",
    publisher: v.publisher || "",
    cover_url: v.imageLinks
      ? (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail).replace("http:", "https:")
      : null,
  };
}

export async function lookupISBN(isbn) {
  const clean = isbn.replace(/[^0-9Xx]/g, "");
  if (clean.length !== 10 && clean.length !== 13) return null;
  return (await fetchOpenLibISBN(clean)) || (await fetchGoogleISBN(clean));
}

export async function searchCatalog(q, page = 1, limit = 20) {
  // Lean field list keeps the response small and fast.
  const r = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&page=${page}&limit=${limit}` +
      `&fields=title,author_name,first_publish_year,isbn,cover_i,language`
  );
  const d = await r.json();
  const results = (d.docs || []).map((doc) => ({
    title: doc.title,
    authors: (doc.author_name || []).slice(0, 3).join(", "),
    isbn13: (doc.isbn || []).find((x) => x.length === 13) || "",
    isbn10: (doc.isbn || []).find((x) => x.length === 10) || "",
    language: doc.language && doc.language[0] ? langName(doc.language[0]) : "",
    published: doc.first_publish_year || "",
    publisher: "",
    cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
  }));
  return { results, numFound: d.numFound ?? d.num_found ?? results.length, page, limit };
}

// Find alternate cover images for a book from Open Library editions.
export async function getAlternateCovers(book) {
  if (!book || (!book.title && !book.authors)) return [];
  const params = new URLSearchParams();
  if (book.title) params.set("title", book.title);
  if (book.authors) params.set("author", book.authors);
  params.set("fields", "cover_i");
  params.set("limit", "20");
  const r = await fetch(`https://openlibrary.org/search.json?${params.toString()}`);
  if (!r.ok) return [];
  const d = await r.json();
  const ids = [];
  (d.docs || []).forEach((doc) => {
    if (doc.cover_i && !ids.includes(doc.cover_i)) ids.push(doc.cover_i);
  });
  return ids.slice(0, 12).map((id) => `https://covers.openlibrary.org/b/id/${id}-M.jpg`);
}

// ---------------- CSV ----------------
export function parseCSV(text) {
  const rows = [];
  let row = [],
    cur = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (c === "\r") {
        /* skip */
      } else cur += c;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

// Parse a CSV (our 5-col export OR a Goodreads export) into book objects + shelf names.
// Returns { books: [...], shelfNames: Set }. Does NOT touch any database.
export function parseBookCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("no data rows");
  const head = rows[0].map((h) => h.trim());
  const col = (...names) => {
    for (const n of names) {
      const i = head.findIndex((h) => h.toLowerCase() === n.toLowerCase());
      if (i >= 0) return i;
    }
    return -1;
  };
  const ci = {
    title: col("Title"),
    author: col("Author", "Authors"),
    isbn: col("ISBN"),
    isbn13: col("ISBN13", "ISBN 13"),
    rating: col("My Rating"),
    year: col("Year", "Original Publication Year", "Year Published"),
    lang: col("Language"),
    shelves: col("Bookshelves"),
    exShelf: col("Exclusive Shelf"),
    review: col("My Review"),
  };
  if (ci.title < 0) throw new Error("no Title column found");
  const clean = (v) => (v == null ? "" : String(v)).replace(/^="?|"?$/g, "").trim();
  const books = [];
  const shelfNames = new Set();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !clean(r[ci.title])) continue;
    const rawIsbn = clean(r[ci.isbn]);
    const rawIsbn13 = clean(r[ci.isbn13]);
    const isbn13 = rawIsbn13 || (rawIsbn.length === 13 ? rawIsbn : "");
    const isbn10 = rawIsbn.length === 10 ? rawIsbn : "";
    const ex = clean(r[ci.exShelf]).toLowerCase();
    const status = ex === "read" ? "read" : ex === "currently-reading" ? "reading" : "to_read";
    const rating = ci.rating >= 0 ? parseInt(clean(r[ci.rating])) || 0 : 0;
    const names =
      ci.shelves >= 0
        ? clean(r[ci.shelves])
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s && !["read", "to-read", "currently-reading"].includes(s))
        : [];
    names.forEach((n) => shelfNames.add(n));
    books.push({
      title: clean(r[ci.title]),
      authors: clean(r[ci.author]),
      isbn13,
      isbn10,
      language: ci.lang >= 0 ? langName(clean(r[ci.lang])) : "",
      published: clean(r[ci.year]),
      status,
      rating,
      notes: ci.review >= 0 ? clean(r[ci.review]) : "",
      shelfNames: names,
    });
  }
  return { books, shelfNames };
}

export function booksToCSV(books) {
  const headers = ["Title", "Author", "Year", "ISBN", "Language"];
  const esc = (v) => {
    v = v == null ? "" : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  const lines = [headers.join(",")];
  books.forEach((b) =>
    lines.push(
      [esc(b.title), esc(b.authors), esc(yearOf(b.published)), esc(b.isbn13 || b.isbn10), esc(b.language || "")].join(
        ","
      )
    )
  );
  return lines.join("\r\n");
}

// Client-side filter/sort used by both the owner view and share pages.
export function filterBooks(books, { shelfBookIds, status, language, tags, search, sort, dir, loan } = {}) {
  let list = books.slice();
  if (shelfBookIds) list = list.filter((b) => shelfBookIds.has(b.id));
  if (status) list = list.filter((b) => b.status === status);
  if (language) list = list.filter((b) => (b.language || "") === language);
  if (loan) list = list.filter((b) => b.loan_status === loan);
  if (tags && tags.length) list = list.filter((b) => tags.every((t) => (b.tags || []).includes(t)));
  const q = (search || "").trim().toLowerCase();
  if (q)
    list = list.filter(
      (b) => (b.title || "").toLowerCase().includes(q) || (b.authors || "").toLowerCase().includes(q)
    );
  if (sort === "title") list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  else if (sort === "author") list.sort((a, b) => authorLastName(a.authors).localeCompare(authorLastName(b.authors)));
  else if (sort === "added") list.sort((a, b) => new Date(b.added_at || 0) - new Date(a.added_at || 0));
  else if (sort === "rating") list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sort === "status") {
    const rank = (k) => {
      const i = STATUSES.findIndex((s) => s.k === k);
      return i < 0 ? 99 : i;
    };
    list.sort((a, b) => rank(a.status) - rank(b.status) || (a.title || "").localeCompare(b.title || ""));
  } else list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  if (dir === "desc") list.reverse();
  return list;
}

export function distinctLanguages(books) {
  return [...new Set(books.map((b) => b.language).filter(Boolean))].sort();
}
export function distinctTags(books) {
  const s = new Set();
  books.forEach((b) => (b.tags || []).forEach((t) => s.add(t)));
  return [...s].sort();
}

// Aggregate stats for the dashboard. Pure: no I/O.
export function computeStats(books) {
  const yearNow = new Date().getFullYear();
  const byStatus = {};
  STATUSES.forEach((s) => (byStatus[s.k] = 0));
  const byLang = {};
  const byAuthor = {};
  const loan = { borrowed: 0, lent: 0 };
  let readThisYear = 0;
  let ratingSum = 0;
  let ratedCount = 0;
  books.forEach((b) => {
    byStatus[b.status] = (byStatus[b.status] || 0) + 1;
    if (b.language) byLang[b.language] = (byLang[b.language] || 0) + 1;
    const author = (b.authors || "").split(",")[0].trim();
    if (author) byAuthor[author] = (byAuthor[author] || 0) + 1;
    if (b.loan_status === "borrowed") loan.borrowed++;
    if (b.loan_status === "lent") loan.lent++;
    if (b.date_finished && new Date(b.date_finished).getFullYear() === yearNow) readThisYear++;
    if (b.rating > 0) {
      ratingSum += b.rating;
      ratedCount++;
    }
  });
  const topAuthors = Object.entries(byAuthor).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
  const topLangs = Object.entries(byLang).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    total: books.length,
    byStatus,
    topLangs,
    topAuthors,
    loan,
    readThisYear,
    avgRating: ratedCount ? ratingSum / ratedCount : 0,
    ratedCount,
  };
}
