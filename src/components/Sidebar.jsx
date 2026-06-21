import { useState } from "react";
import * as db from "../lib/db.js";
import { distinctLanguages, distinctTags, STATUSES, LOANS } from "../lib/books.js";
import { toast } from "./Toast.jsx";

function shareUrl(kind, slug) {
  return `${window.location.origin}/share/${kind}/${slug}`;
}

export default function Sidebar({
  profile,
  shelves,
  books,
  shelfIndex,
  activeShelf,
  setActiveShelf,
  filters,
  setFilters,
  onChange,
  onDropBooks,
}) {
  const [newShelf, setNewShelf] = useState("");
  const [dropShelf, setDropShelf] = useState(null);
  const langs = distinctLanguages(books);
  const tags = distinctTags(books);

  function handleDrop(e, shelfId) {
    e.preventDefault();
    setDropShelf(null);
    const raw = e.dataTransfer.getData("application/book-ids");
    if (!raw) return;
    try {
      const ids = JSON.parse(raw);
      if (Array.isArray(ids) && ids.length) onDropBooks?.(shelfId, ids);
    } catch {
      /* ignore */
    }
  }

  async function addShelf() {
    const name = newShelf.trim();
    if (!name) return;
    if (shelves.some((s) => s.name.toLowerCase() === name.toLowerCase())) return toast("Shelf exists");
    setNewShelf("");
    try {
      await db.addShelf(name);
      onChange();
      toast("Shelf added");
    } catch {
      toast("Could not add shelf");
    }
  }

  async function removeShelf(s) {
    if (!confirm(`Delete shelf "${s.name}"? Books stay in your library.`)) return;
    try {
      await db.deleteShelf(s.id);
      if (activeShelf === s.id) setActiveShelf("all");
      onChange();
    } catch {
      toast("Could not delete shelf");
    }
  }

  async function toggleShelfPublic(s) {
    try {
      const updated = await db.updateShelf(s.id, { is_public: !s.is_public });
      toast(updated.is_public ? "Shelf is now public" : "Shelf is now private");
      onChange();
    } catch {
      toast("Could not update sharing");
    }
  }

  async function toggleLibraryPublic() {
    try {
      const updated = await db.updateProfile({ library_public: !profile?.library_public });
      toast(updated.library_public ? "Library is now public" : "Library is now private");
      onChange();
    } catch {
      toast("Could not update sharing");
    }
  }

  function copyLink(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast("Link copied")).catch(() => toast("Copy failed"));
    } else {
      toast(text);
    }
  }

  const toggleTag = (t) =>
    setFilters((f) => ({
      ...f,
      tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t],
    }));

  return (
    <aside>
      <h2>Shelves</h2>
      <div
        className={"shelf" + (activeShelf === "all" ? " active" : "")}
        onClick={() => setActiveShelf("all")}
      >
        <span>📚</span>
        <span>All books</span>
        <span className="count">{books.length}</span>
      </div>
      {shelves.map((s) => (
        <div
          key={s.id}
          className={"shelf" + (activeShelf === s.id ? " active" : "") + (dropShelf === s.id ? " droptarget" : "")}
          onClick={() => setActiveShelf(s.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            removeShelf(s);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDropShelf(s.id);
          }}
          onDragLeave={() => setDropShelf((d) => (d === s.id ? null : d))}
          onDrop={(e) => handleDrop(e, s.id)}
          title="Right-click to delete · drop books here to add them"
        >
          <span>🔖</span>
          <span>{s.name}</span>
          {s.is_public && (
            <span
              className="share copy"
              title="Copy share link"
              onClick={(e) => {
                e.stopPropagation();
                copyLink(shareUrl("shelf", s.share_slug));
              }}
            >
              🔗
            </span>
          )}
          <span
            className="share toggle"
            title={s.is_public ? "Public — click to make private" : "Private — click to make public"}
            onClick={(e) => {
              e.stopPropagation();
              toggleShelfPublic(s);
            }}
          >
            {s.is_public ? "🔓" : "🔒"}
          </span>
          <span className="count">{(shelfIndex.get(s.id) || new Set()).size}</span>
        </div>
      ))}
      <div className="miniadd">
        <input
          value={newShelf}
          placeholder="New shelf…"
          onChange={(e) => setNewShelf(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addShelf()}
        />
        <button onClick={addShelf}>Add</button>
      </div>

      <h2>Filter by tag</h2>
      <div className="tagrow">
        {tags.length ? (
          tags.map((t) => (
            <button
              key={t}
              className={"tag" + (filters.tags.includes(t) ? " sel" : "")}
              onClick={() => toggleTag(t)}
            >
              {t}
            </button>
          ))
        ) : (
          <span className="note" style={{ padding: "4px 6px" }}>
            No tags yet
          </span>
        )}
      </div>

      <h2>Status</h2>
      <div className="tagrow">
        {STATUSES.map((s) => (
          <button
            key={s.k}
            className={"tag" + (filters.status === s.k ? " sel" : "")}
            onClick={() => setFilters((f) => ({ ...f, status: f.status === s.k ? null : s.k }))}
          >
            {s.label}
          </button>
        ))}
      </div>

      <h2>Filter by language</h2>
      <div className="tagrow">
        {langs.length ? (
          langs.map((l) => (
            <button
              key={l}
              className={"tag" + (filters.language === l ? " sel" : "")}
              onClick={() => setFilters((f) => ({ ...f, language: f.language === l ? null : l }))}
            >
              {l}
            </button>
          ))
        ) : (
          <span className="note" style={{ padding: "4px 6px" }}>
            No languages yet
          </span>
        )}
      </div>

      <h2>On loan</h2>
      <div className="tagrow">
        {Object.entries(LOANS).map(([k, v]) => (
          <button
            key={k}
            className={"tag" + (filters.loan === k ? " sel" : "")}
            onClick={() => setFilters((f) => ({ ...f, loan: f.loan === k ? null : k }))}
          >
            {v.label}
          </button>
        ))}
      </div>

      <h2>Share</h2>
      <div style={{ padding: "4px 6px" }}>
        <label className="switch-row">
          <span>Public library</span>
          <span className="switch">
            <input type="checkbox" checked={!!profile?.library_public} onChange={toggleLibraryPublic} />
            <span className="slider" />
          </span>
        </label>
        {profile?.library_public && (
          <>
            <button
              className="btn"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => copyLink(shareUrl("library", profile.library_slug))}
            >
              🔗 Click to copy link
            </button>
            <div className="note" style={{ marginTop: 6, wordBreak: "break-all" }}>
              {shareUrl("library", profile.library_slug)}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
