import { useEffect, useState } from "react";
import * as db from "../lib/db.js";
import { LANGS, STATUSES, coverUrl, getAlternateCovers } from "../lib/books.js";
import { shrinkImage } from "../lib/image.js";
import { toast } from "./Toast.jsx";

export default function BookDetail({ book, shelves, shelfIndex, onClose, onSaved }) {
  const [title, setTitle] = useState(book.title || "");
  const [authors, setAuthors] = useState(book.authors || "");
  const [status, setStatus] = useState(book.status || "to_read");
  const [rating, setRating] = useState(book.rating || 0);
  const [language, setLanguage] = useState(book.language || "");
  const [notes, setNotes] = useState(book.notes || "");
  const [readingNotes, setReadingNotes] = useState(book.reading_notes || "");
  const [loanStatus, setLoanStatus] = useState(book.loan_status || "none");
  const [loanParty, setLoanParty] = useState(book.loan_party || "");
  const [dateStarted, setDateStarted] = useState(book.date_started || "");
  const [dateFinished, setDateFinished] = useState(book.date_finished || "");
  const [tags, setTags] = useState([...(book.tags || [])]);
  const [tagInput, setTagInput] = useState("");
  const [shelfSel, setShelfSel] = useState(
    () => new Set(shelves.filter((s) => (shelfIndex.get(s.id) || new Set()).has(book.id)).map((s) => s.id))
  );
  const [busy, setBusy] = useState(false);

  // cover state: "" means fall back to the catalog/ISBN cover
  const [cover, setCover] = useState(book.cover_url || "");
  const [urlInput, setUrlInput] = useState("");
  const [alts, setAlts] = useState(null); // null=not loaded, "loading", or array
  const [coverBusy, setCoverBusy] = useState(false);
  const previewUrl = cover || coverUrl(book);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onUpload(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setCoverBusy(true);
    try {
      const { blob, ext } = await shrinkImage(file);
      const url = await db.uploadCover(book.id, blob, ext);
      setCover(url);
      toast("Cover uploaded — click Save to keep it");
    } catch (err) {
      console.error(err);
      toast(err.message || "Upload failed");
    }
    setCoverBusy(false);
  }
  function applyUrl() {
    const v = urlInput.trim();
    if (!v) return;
    setCover(v);
    setUrlInput("");
    toast("Cover set — click Save to keep it");
  }
  async function findAlts() {
    setAlts("loading");
    try {
      setAlts(await getAlternateCovers(book));
    } catch {
      setAlts([]);
    }
  }

  function addTag() {
    const v = tagInput.trim();
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput("");
  }
  function toggleShelf(id) {
    setShelfSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function save() {
    setBusy(true);
    try {
      await db.updateBook(book.id, {
        title: title.trim(),
        authors: authors.trim(),
        status,
        rating: Number(rating),
        language,
        notes,
        reading_notes: readingNotes,
        loan_status: loanStatus,
        loan_party: loanStatus === "none" ? "" : loanParty.trim(),
        date_started: dateStarted || null,
        date_finished: dateFinished || null,
        tags,
        cover_url: cover,
      });
      await db.setBookShelves(book.id, [...shelfSel]);
      toast("Saved");
      onSaved();
    } catch (e) {
      console.error(e);
      toast("Could not save");
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Remove this book from your library?")) return;
    try {
      await db.deleteBook(book.id);
      toast("Removed");
      onSaved();
    } catch {
      toast("Could not remove");
    }
  }

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal book-wide" role="dialog" aria-modal="true" aria-label={`Details for ${book.title || "book"}`}>
        <div className="mh">
          <h3>Book details</h3>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="body book">
          <div className="page left">
          <div className="detail-grid">
            <div>
              <div className="dcover">
                {previewUrl ? (
                  <img src={previewUrl} alt={book.title ? `Cover of ${book.title}` : ""} loading="lazy" onError={(e) => (e.target.style.display = "none")} />
                ) : (
                  <div className="ph" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)", fontSize: 12 }}>
                    No cover
                  </div>
                )}
              </div>

              <div className="cover-actions">
                <label className="btn">
                  {coverBusy ? "Uploading…" : "⬆ Upload image"}
                  <input type="file" accept="image/*" hidden onChange={onUpload} disabled={coverBusy} />
                </label>

                <input
                  type="text"
                  placeholder="Paste image URL"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyUrl()}
                />
                <button className="btn" onClick={applyUrl} disabled={!urlInput.trim()}>
                  Use this URL
                </button>

                <button className="btn" onClick={findAlts}>
                  🔍 Find other covers
                </button>

                {alts === "loading" && <div className="note"><span className="spin" /> Searching…</div>}
                {Array.isArray(alts) &&
                  (alts.length ? (
                    <div className="alt-grid">
                      {alts.map((u) => (
                        <img
                          key={u}
                          src={u}
                          alt="Alternate cover option"
                          loading="lazy"
                          className={cover === u ? "sel" : ""}
                          onClick={() => {
                            setCover(u);
                            toast("Cover set — click Save to keep it");
                          }}
                          onError={(e) => (e.target.style.display = "none")}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="note">No alternate covers found.</div>
                  ))}
              </div>
            </div>
            <div>
              <div className="field">
                <label>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="field">
                <label>Authors</label>
                <input value={authors} onChange={(e) => setAuthors(e.target.value)} />
              </div>
              <div className="row3">
                <div className="field">
                  <label>Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUSES.map((s) => (
                      <option key={s.k} value={s.k}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Rating</label>
                  <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n ? "★".repeat(n) : "—"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Language</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="">—</option>
                    {LANGS.map((l) => (
                      <option key={l.code} value={l.name}>
                        {l.name}
                      </option>
                    ))}
                    {language && !LANGS.some((l) => l.name === language) && (
                      <option value={language}>{language}</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="row2">
                <div className="field">
                  <label>Date started</label>
                  <input type="date" value={dateStarted || ""} onChange={(e) => setDateStarted(e.target.value)} />
                </div>
                <div className="field">
                  <label>Date finished</label>
                  <input type="date" value={dateFinished || ""} onChange={(e) => setDateFinished(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Tags</label>
                <div className="chips-edit">
                  {tags.length ? (
                    tags.map((t) => (
                      <span className="tag" key={t}>
                        {t}
                        <span className="rm" onClick={() => setTags(tags.filter((x) => x !== t))}>
                          ✕
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="note">none</span>
                  )}
                </div>
                <input
                  style={{ marginTop: 6 }}
                  placeholder="Type a tag, press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
              </div>
              <div className="field">
                <label>Shelves</label>
                <div className="shelf-checks">
                  {shelves.length ? (
                    shelves.map((s) => (
                      <label key={s.id}>
                        <input
                          type="checkbox"
                          checked={shelfSel.has(s.id)}
                          onChange={() => toggleShelf(s.id)}
                        />{" "}
                        {s.name}
                      </label>
                    ))
                  ) : (
                    <span className="note">No shelves yet — add one from the sidebar.</span>
                  )}
                </div>
              </div>
              <div className="field">
                <label>On loan</label>
                <div className="row2">
                  <select value={loanStatus} onChange={(e) => setLoanStatus(e.target.value)}>
                    <option value="none">Not on loan</option>
                    <option value="borrowed">Borrowed from…</option>
                    <option value="lent">Lent to…</option>
                  </select>
                  {loanStatus !== "none" && (
                    <input
                      value={loanParty}
                      onChange={(e) => setLoanParty(e.target.value)}
                      placeholder={loanStatus === "borrowed" ? "Who you borrowed it from" : "Who you lent it to"}
                    />
                  )}
                </div>
              </div>
              <div className="field">
                <label>Comments / Observations</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you thought of it, context, status notes…" />
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn primary" disabled={busy} onClick={save}>
                  {busy ? "Saving…" : "Save"}
                </button>
                <button className="btn danger" onClick={remove}>
                  Remove from library
                </button>
                {(book.isbn13 || book.isbn10) && (
                  <span className="note">
                    ISBN {book.isbn13 || book.isbn10}
                    {book.published ? " · " + book.published : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          </div>
          <div className="page right">
            <label className="page-title">Reading Notes</label>
            <textarea
              className="reading-notes"
              value={readingNotes}
              onChange={(e) => setReadingNotes(e.target.value)}
              placeholder="Quotes, passages, page references — your reading log for this book…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
