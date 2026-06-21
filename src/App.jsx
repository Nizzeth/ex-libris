import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth, signOut } from "./context/AuthContext.jsx";
import * as db from "./lib/db.js";
import { booksToCSV, filterBooks, distinctTags } from "./lib/books.js";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import CoverWall from "./components/CoverWall.jsx";
import SpineView from "./components/SpineView.jsx";
import AddModal from "./components/AddModal.jsx";
import BookDetail from "./components/BookDetail.jsx";
import { Toaster, toast } from "./components/Toast.jsx";

export default function App() {
  const { session, loading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [books, setBooks] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [shelfBooks, setShelfBooks] = useState([]); // [{shelf_id, book_id}]
  const [ready, setReady] = useState(false);

  const [activeShelf, setActiveShelf] = useState("all");
  const [filters, setFilters] = useState({ status: null, language: null, loan: null, tags: [], search: "", sort: "manual", dir: "asc" });
  const [showAdd, setShowAdd] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const [view, setView] = useState(() => localStorage.getItem("exlibris_view") || "wall");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [tagDraft, setTagDraft] = useState("");

  function changeView(v) {
    setView(v);
    localStorage.setItem("exlibris_view", v);
  }
  function toggleSelect(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  const reloadAll = useCallback(async () => {
    const [p, b, s, sb] = await Promise.all([
      db.getMyProfile(),
      db.listBooks(),
      db.listShelves(),
      db.listShelfBooks(),
    ]);
    setProfile(p);
    setBooks(b);
    setShelves(s);
    setShelfBooks(sb);
    setReady(true);
  }, []);

  useEffect(() => {
    if (session) {
      setReady(false);
      reloadAll().catch((e) => {
        console.error(e);
        toast("Could not load your library");
      });
    }
  }, [session, reloadAll]);

  const shelfIndex = useMemo(() => {
    const m = new Map();
    shelfBooks.forEach(({ shelf_id, book_id }) => {
      if (!m.has(shelf_id)) m.set(shelf_id, new Set());
      m.get(shelf_id).add(book_id);
    });
    return m;
  }, [shelfBooks]);

  const visibleBooks = useMemo(() => {
    const shelfBookIds = activeShelf === "all" ? null : shelfIndex.get(activeShelf) || new Set();
    return filterBooks(books, { ...filters, shelfBookIds });
  }, [books, filters, activeShelf, shelfIndex]);

  if (loading) return <div className="center"><span className="spin" /></div>;
  if (!session) return <Login />;

  const me = session.user;
  const shelvesById = Object.fromEntries(shelves.map((s) => [s.id, s]));

  async function handleExport() {
    const csv = booksToCSV(books);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ex-libris.csv";
    a.click();
    toast("Exported " + books.length + " books");
  }

  async function handleBackup() {
    try {
      const data = await db.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ex-libris-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      toast("Backed up " + data.books.length + " books");
    } catch (e) {
      console.error(e);
      toast("Backup failed");
    }
  }

  async function handleRestore(file) {
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return toast("That isn't a valid JSON file");
    }
    if (!data.books) return toast("Not an Ex Libris backup");
    if (!confirm(`Restore ${data.books.length} books from this backup? Existing books (matched by ISBN) are kept; this only adds and re-links.`)) return;
    try {
      const res = await db.importBackup(data);
      toast(`Restored ${res.books} books` + (res.shelves ? ` and ${res.shelves} shelves` : ""));
      reloadAll();
    } catch (e) {
      console.error(e);
      toast("Restore failed: " + (e.message || "unknown error"));
    }
  }

  async function reorder(orderedIds) {
    const pos = Object.fromEntries(orderedIds.map((id, i) => [id, i]));
    setBooks((prev) => prev.map((b) => (pos[b.id] != null ? { ...b, sort_order: pos[b.id] } : b)));
    try {
      await db.reorderBooks(orderedIds);
    } catch {
      toast("Couldn't save order");
      reloadAll();
    }
  }

  async function moveBooksToShelf(shelfId, ids) {
    if (!shelfId || !ids.length) return;
    try {
      await db.addBooksToShelf(shelfId, ids);
      const name = shelvesById[shelfId]?.name || "shelf";
      toast(`Moved ${ids.length} book${ids.length === 1 ? "" : "s"} to “${name}”`);
      setSelected(new Set());
      reloadAll();
    } catch (e) {
      console.error(e);
      toast("Could not move books");
    }
  }

  async function tagSelected(rawTag, add) {
    const tag = rawTag.trim();
    if (!tag || !selected.size) return;
    const ids = [...selected];
    const updates = ids
      .map((id) => {
        const b = books.find((x) => x.id === id);
        if (!b) return null;
        const cur = b.tags || [];
        if (add) {
          if (cur.includes(tag)) return null;
          return db.updateBook(id, { tags: [...cur, tag] });
        }
        if (!cur.includes(tag)) return null;
        return db.updateBook(id, { tags: cur.filter((t) => t !== tag) });
      })
      .filter(Boolean);
    if (!updates.length) {
      toast(add ? "All selected already have that tag" : "None of the selected had that tag");
      return;
    }
    try {
      await Promise.all(updates);
      toast(`${add ? "Added" : "Removed"} “${tag}” ${add ? "to" : "from"} ${updates.length} book${updates.length === 1 ? "" : "s"}`);
      reloadAll(); // selection (by id) persists, so you can keep tagging the same set
    } catch (e) {
      console.error(e);
      toast("Could not update tags");
    }
  }

  const viewProps = {
    books: visibleBooks,
    onOpen: setDetailId,
    selectMode,
    selected,
    onToggleSelect: toggleSelect,
  };

  return (
    <>
      <header className="app">
        <h1>Ex Libris</h1>
        <span className="sub">Your personal archive</span>
        <div className="spacer" />
        <span className="who">{me.email}</span>
        <button onClick={() => setShowAdd(true)}>+ Add books</button>
        <button onClick={handleExport}>Export CSV</button>
        <button onClick={handleBackup}>Backup</button>
        <button onClick={() => document.getElementById("restoreFile").click()}>Restore</button>
        <input
          id="restoreFile"
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            if (e.target.files[0]) handleRestore(e.target.files[0]);
            e.target.value = "";
          }}
        />
        <button onClick={() => signOut()}>Sign out</button>
      </header>

      <div className="layout">
        <Sidebar
          profile={profile}
          shelves={shelves}
          books={books}
          shelfIndex={shelfIndex}
          activeShelf={activeShelf}
          setActiveShelf={setActiveShelf}
          filters={filters}
          setFilters={setFilters}
          onChange={reloadAll}
          onDropBooks={moveBooksToShelf}
        />
        <main>
          <div className="toolbar">
            <span className="title">
              {activeShelf === "all" ? "All books" : shelvesById[activeShelf]?.name || "Shelf"}
            </span>
            <div className="spacer" />
            <div className="viewtoggle">
              <button className={view === "wall" ? "on" : ""} title="Cover wall" onClick={() => changeView("wall")}>
                ▦
              </button>
              <button className={view === "shelf" ? "on" : ""} title="Shelf view" onClick={() => changeView("shelf")}>
                ▤
              </button>
            </div>
            <button
              className={"btn" + (selectMode ? " primary" : "")}
              onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            >
              {selectMode ? "Done" : "Select"}
            </button>
            <input
              className="search"
              placeholder="Search title or author…"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
              <option value="manual">Sort: Manual</option>
              <option value="title">Sort: Title</option>
              <option value="author">Sort: Author</option>
              <option value="status">Sort: Status</option>
              <option value="added">Sort: Recently added</option>
              <option value="rating">Sort: Rating</option>
            </select>
            <button
              className="btn dirtoggle"
              title={filters.dir === "desc" ? "Descending — click for ascending" : "Ascending — click for descending"}
              onClick={() => setFilters((f) => ({ ...f, dir: f.dir === "desc" ? "asc" : "desc" }))}
            >
              {filters.dir === "desc" ? "↓" : "↑"}
            </button>
          </div>

          {selectMode && (
            <div className="selbar">
              <span>
                <b>{selected.size}</b> selected
              </span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) moveBooksToShelf(e.target.value, [...selected]);
                  e.target.value = "";
                }}
                disabled={!selected.size || !shelves.length}
              >
                <option value="">Move to shelf…</option>
                {shelves.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="seltag-group">
                <input
                  list="all-tags"
                  placeholder="tag…"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && tagSelected(tagDraft, true)}
                  disabled={!selected.size}
                />
                <datalist id="all-tags">
                  {distinctTags(books).map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <button className="btn" onClick={() => tagSelected(tagDraft, true)} disabled={!selected.size || !tagDraft.trim()}>
                  + Tag
                </button>
                <button className="btn" onClick={() => tagSelected(tagDraft, false)} disabled={!selected.size || !tagDraft.trim()}>
                  – Tag
                </button>
              </span>
              <button className="btn" onClick={() => setSelected(new Set(visibleBooks.map((b) => b.id)))}>
                Select all
              </button>
              <button className="btn" onClick={() => setSelected(new Set())} disabled={!selected.size}>
                Clear
              </button>
              <span className="note">…or drag selected books onto a shelf in the sidebar.</span>
            </div>
          )}

          {!ready ? (
            <div className="empty"><span className="spin" /></div>
          ) : view === "shelf" ? (
            <SpineView {...viewProps} canReorder={filters.sort === "manual" && !selectMode} onReorder={reorder} />
          ) : (
            <CoverWall {...viewProps} canReorder={filters.sort === "manual" && !selectMode} onReorder={reorder} />
          )}
        </main>
      </div>

      {showAdd && (
        <AddModal
          shelves={shelves}
          onClose={() => setShowAdd(false)}
          onCommitted={() => {
            setShowAdd(false);
            reloadAll();
          }}
        />
      )}

      {detailId && books.some((b) => b.id === detailId) && (
        <BookDetail
          book={books.find((b) => b.id === detailId)}
          shelves={shelves}
          shelfIndex={shelfIndex}
          onClose={() => setDetailId(null)}
          onSaved={() => {
            setDetailId(null);
            reloadAll();
          }}
        />
      )}

      <Toaster />
    </>
  );
}
