import { useState } from "react";
import * as db from "../lib/db.js";
import { distinctLanguages, distinctTags, STATUSES, LOANS } from "../lib/books.js";
import { toast } from "./Toast.jsx";

function shareUrl(kind, slug) {
  return `${window.location.origin}/share/${kind}/${slug}`;
}

const SHELF_COLORS = ["#7c4d2e", "#7a2e2e", "#6b7c3f", "#b9824f", "#8a6db0", "#2e6f8e", "#c2562a", "#9d4edd", "#3b6d2e", "#5f5e5a"];

function BookmarkIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", fill: color || "var(--accent)" }}>
      <path d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1z" />
    </svg>
  );
}

export default function Sidebar({
  open,
  onNavigate,
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
  onReorderShelves,
}) {
  const selectShelf = (id) => {
    setActiveShelf(id);
    onNavigate?.();
  };
  const [newShelf, setNewShelf] = useState("");
  const [dropShelf, setDropShelf] = useState(null);
  const [editingShelfId, setEditingShelfId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const [colorShelf, setColorShelf] = useState(null);
  const langs = distinctLanguages(books);
  const tags = distinctTags(books);

  // Drop can carry either a dragged shelf (reorder) or books (add to shelf).
  function handleDrop(e, shelfId) {
    e.preventDefault();
    setDropShelf(null);
    const draggedShelf = e.dataTransfer.getData("application/shelf-id");
    if (draggedShelf) {
      reorderTo(draggedShelf, shelfId);
      return;
    }
    const raw = e.dataTransfer.getData("application/book-ids");
    if (!raw) return;
    try {
      const ids = JSON.parse(raw);
      if (Array.isArray(ids) && ids.length) onDropBooks?.(shelfId, ids);
    } catch {
      /* ignore */
    }
  }

  function reorderTo(fromId, toId) {
    if (!fromId || fromId === toId) return;
    const ids = shelves.map((x) => x.id);
    const fi = ids.indexOf(fromId);
    const ti = ids.indexOf(toId);
    if (fi < 0 || ti < 0) return;
    ids.splice(ti, 0, ids.splice(fi, 1)[0]);
    onReorderShelves?.(ids);
  }

  async function saveRename(s) {
    const name = nameDraft.trim();
    setEditingShelfId(null);
    if (!name || name === s.name) return;
    if (shelves.some((x) => x.id !== s.id && x.name.toLowerCase() === name.toLowerCase())) return toast("Shelf exists");
    try {
      await db.updateShelf(s.id, { name });
      onChange();
    } catch {
      toast("Could not rename");
    }
  }

  async function setShelfColor(s, color) {
    setColorShelf(null);
    try {
      await db.updateShelf(s.id, { color });
      onChange();
    } catch {
      toast("Could not set color");
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
    <aside className={open ? "open" : ""}>
      <h2>Shelves</h2>
      <div
        className={"shelf" + (activeShelf === "all" ? " active" : "")}
        onClick={() => selectShelf("all")}
      >
        <span>📚</span>
        <span>All books</span>
        <span className="count">{books.length}</span>
      </div>
      {shelves.map((s) => {
        const editing = editingShelfId === s.id;
        return (
        <div
          key={s.id}
          className={"shelf" + (activeShelf === s.id ? " active" : "") + (dropShelf === s.id ? " droptarget" : "")}
          draggable={!editing}
          onClick={() => !editing && selectShelf(s.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            removeShelf(s);
          }}
          onDragStart={(e) => {
            if (editing) { e.preventDefault(); return; }
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("application/shelf-id", s.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDropShelf(s.id);
          }}
          onDragLeave={() => setDropShelf((d) => (d === s.id ? null : d))}
          onDrop={(e) => handleDrop(e, s.id)}
          title="Drag to reorder · double-click name to rename · right-click to delete"
        >
          <span
            className="shelf-icon"
            role="button"
            tabIndex={0}
            aria-label={`Change colour of ${s.name}`}
            title="Change colour"
            onClick={(e) => { e.stopPropagation(); setColorShelf((c) => (c === s.id ? null : s.id)); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); setColorShelf((c) => (c === s.id ? null : s.id)); } }}
          >
            <BookmarkIcon color={s.color} />
          </span>
          {editing ? (
            <input
              className="shelf-rename"
              autoFocus
              value={nameDraft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => saveRename(s)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename(s);
                if (e.key === "Escape") setEditingShelfId(null);
              }}
            />
          ) : (
            <span
              className="shelf-name"
              onDoubleClick={(e) => { e.stopPropagation(); setNameDraft(s.name); setEditingShelfId(s.id); }}
            >
              {s.name}
            </span>
          )}
          {s.is_public && (
            <span
              className="share copy"
              role="button"
              tabIndex={0}
              aria-label={`Copy share link for ${s.name}`}
              title="Copy share link"
              onClick={(e) => {
                e.stopPropagation();
                copyLink(shareUrl("shelf", s.share_slug));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  copyLink(shareUrl("shelf", s.share_slug));
                }
              }}
            >
              🔗
            </span>
          )}
          <span
            className="share toggle"
            role="button"
            tabIndex={0}
            aria-label={s.is_public ? `${s.name} is public, make private` : `${s.name} is private, make public`}
            title={s.is_public ? "Public — click to make private" : "Private — click to make public"}
            onClick={(e) => {
              e.stopPropagation();
              toggleShelfPublic(s);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                toggleShelfPublic(s);
              }
            }}
          >
            {s.is_public ? "🔓" : "🔒"}
          </span>
          <span className="count">{(shelfIndex.get(s.id) || new Set()).size}</span>
          {colorShelf === s.id && (
            <div className="color-pop" onClick={(e) => e.stopPropagation()}>
              {SHELF_COLORS.map((c) => (
                <button
                  key={c}
                  className="swatch"
                  style={{ background: c }}
                  aria-label={"Set colour " + c}
                  onClick={() => setShelfColor(s, c)}
                />
              ))}
              <button className="swatch swatch-clear" onClick={() => setShelfColor(s, "")} title="Default" aria-label="Default colour">
                ○
              </button>
            </div>
          )}
        </div>
        );
      })}
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
