import { useEffect, useRef, useState } from "react";
import * as db from "../lib/db.js";
import { LANGS, lookupISBN, searchCatalog, parseBookCSV, coverUrl, STATUSES } from "../lib/books.js";
import { toast } from "./Toast.jsx";

const ZXING_CDN = "https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js";

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src;
    s.dataset.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error("script load failed"));
    document.head.appendChild(s);
  });
}

export default function AddModal({ shelves, onClose, onCommitted }) {
  const [tab, setTab] = useState("isbn");
  const [tray, setTray] = useState([]);
  const [committing, setCommitting] = useState(false);

  const key = (b) => b.isbn13 || b.isbn10 || `${b.title}|${b.authors}`.toLowerCase();
  function addToTray(b) {
    setTray((prev) => (prev.some((x) => key(x) === key(b)) ? prev : [...prev, b]));
  }

  async function commit() {
    if (!tray.length || committing) return; // guard against double-clicks
    setCommitting(true);
    let n = 0;
    for (const b of tray) {
      try {
        const { created } = await db.addBook(b);
        if (created) n++;
      } catch (e) {
        console.error(e);
      }
    }
    toast("Added " + n + " book" + (n === 1 ? "" : "s"));
    setCommitting(false);
    onCommitted();
  }

  return (
    <div className="scrim">
      <div className="modal add-wide">
        <div className="mh">
          <h3>Add books</h3>
          <button className="x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="body add-body">
          <div className="add-main">
          <div className="tabs">
            {[
              ["scan", "📷 Scan"],
              ["isbn", "ISBN"],
              ["search", "Search"],
              ["csv", "Import CSV"],
              ["manual", "Manual"],
            ].map(([k, label]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>

          {tab === "scan" && <ScanTab onFound={addToTray} active />}
          {tab === "isbn" && <IsbnTab onAdd={addToTray} />}
          {tab === "search" && <SearchTab onAdd={addToTray} />}
          {tab === "csv" && <CsvTab shelves={shelves} onDone={onCommitted} />}
          {tab === "manual" && <ManualTab onAdd={addToTray} />}
          </div>

          <div className="add-tray">
            <button className="btn primary tray-commit" disabled={!tray.length || committing} onClick={commit}>
              {committing ? (
                <>
                  <span className="spin" /> Adding…
                </>
              ) : (
                <>Add {tray.length || ""} to library</>
              )}
            </button>
            <div className="tray-head" style={{ fontSize: 14, margin: "10px 0 8px" }}>
              🧺 <b>{tray.length}</b> book(s) ready to add
            </div>
            <div id="trayList">
              {tray.length ? (
                tray.map((b, i) => (
                  <div className="trow" key={i}>
                    <span className="tt">
                      {b.title} <span className="note">{b.authors}</span>
                    </span>
                    <span className="rm" onClick={() => setTray((p) => p.filter((_, j) => j !== i))}>
                      ✕
                    </span>
                  </div>
                ))
              ) : (
                <span className="note">
                  Nothing yet — add from any tab above. Scan several, paste a list of ISBNs, or pick from
                  search.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Scan ---------------- */
function ScanTab({ onFound }) {
  const [msg, setMsg] = useState(
    "Point your camera at a book's barcode (ISBN / EAN-13). Each match drops into the tray below."
  );
  const readerRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const seen = useRef(new Set());

  function stop() {
    try {
      readerRef.current?.reset();
    } catch {}
    readerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }
  useEffect(() => () => stop(), []);

  async function handle(code) {
    code = (code || "").replace(/[^0-9Xx]/g, "");
    if (code.length !== 13 && code.length !== 10) return;
    if (seen.current.has(code)) return;
    seen.current.add(code);
    setMsg("Looking up " + code + "…");
    try {
      const data = await lookupISBN(code);
      if (data) {
        onFound(data);
        setMsg("Added “" + data.title + "”. Keep scanning…");
      } else setMsg("No match for " + code + ".");
    } catch {
      setMsg("Lookup failed for " + code + ".");
    }
  }

  async function start() {
    seen.current = new Set();
    stop();
    try {
      if (!window.ZXing) {
        setMsg("Loading scanner…");
        await loadScript(ZXING_CDN);
      }
    } catch {}
    if (window.ZXing) {
      try {
        readerRef.current = new window.ZXing.BrowserMultiFormatReader();
        await readerRef.current.decodeFromVideoDevice(null, "scanVid", (result) => {
          if (result) handle(result.getText());
        });
        setMsg("Scanning… hold a barcode steady in the frame.");
        return;
      } catch (e) {
        setMsg("Camera error: " + (e.message || "access denied") + ". Use the ISBN tab.");
        return;
      }
    }
    if ("BarcodeDetector" in window) return startNative();
    setMsg("Scanner unavailable (offline & no built-in scanner). Use the ISBN tab.");
  }

  async function startNative() {
    try {
      const vid = document.getElementById("scanVid");
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      vid.srcObject = streamRef.current;
      await vid.play();
      const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a"] });
      const loop = async () => {
        try {
          const codes = await det.detect(vid);
          if (codes && codes.length) handle(codes[0].rawValue);
        } catch {}
        rafRef.current = requestAnimationFrame(loop);
      };
      setMsg("Scanning… hold a barcode steady in the frame.");
      loop();
    } catch (e) {
      setMsg("Camera error: " + (e.message || "access denied") + ". Use the ISBN tab.");
    }
  }

  return (
    <div>
      <div id="scanWrap">
        <video id="scanVid" playsInline muted />
        <div className="reticle" />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="btn primary" onClick={start}>
          Start camera
        </button>
        <button
          className="btn"
          onClick={() => {
            stop();
            setMsg("Camera stopped.");
          }}
        >
          Stop
        </button>
      </div>
      <div className="note" style={{ marginTop: 8 }}>
        {msg}
      </div>
    </div>
  );
}

/* ---------------- ISBN (one or many) ---------------- */
function IsbnTab({ onAdd }) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    const codes = [
      ...new Set(
        text
          .split(/[\s,;]+/)
          .map((s) => s.replace(/[^0-9Xx]/g, ""))
          .filter((s) => s.length === 10 || s.length === 13)
      ),
    ];
    if (!codes.length) return setMsg("Enter one or more valid ISBNs (10 or 13 digits).");
    setBusy(true);
    setMsg("Looking up " + codes.length + "…");
    let ok = 0;
    const fail = [];
    for (const c of codes) {
      try {
        const d = await lookupISBN(c);
        if (d) {
          onAdd(d);
          ok++;
        } else fail.push(c);
      } catch {
        fail.push(c);
      }
    }
    setBusy(false);
    setMsg(`Added ${ok} to tray.` + (fail.length ? " Not found: " + fail.join(", ") : ""));
  }

  return (
    <div>
      <div className="field">
        <label>ISBN(s) — one or more</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Separated by spaces, commas, or new lines\n9780143127741\n9780802130303"}
        />
      </div>
      <button className="btn primary" disabled={busy} onClick={go}>
        {busy ? "Looking up…" : "Look up & add to tray"}
      </button>
      <div className="note" style={{ marginTop: 8 }}>
        Fetches title, author, language &amp; cover from Open Library (Google Books fallback).
      </div>
      {msg && <div className="note" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

/* ---------------- Search ---------------- */
function SearchTab({ onAdd }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [msg, setMsg] = useState("");

  async function go() {
    if (!q.trim()) return;
    setMsg("Searching Open Library…");
    setResults([]);
    try {
      const r = await searchCatalog(q.trim());
      setMsg(r.length ? "" : "No results.");
      setResults(r);
    } catch {
      setMsg("Search failed (network).");
    }
  }

  return (
    <div>
      <div className="field">
        <label>Search by title or author</label>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
      </div>
      <button className="btn primary" onClick={go}>
        Search
      </button>
      {msg && <div className="note" style={{ marginTop: 8 }}>{msg}</div>}
      <div className="results">
        {results.map((b, i) => (
          <ResultRow key={i} b={b} onAdd={() => { onAdd(b); toast("Added to tray"); }} />
        ))}
      </div>
    </div>
  );
}

function ResultRow({ b, onAdd }) {
  const [broken, setBroken] = useState(false);
  const cu = coverUrl(b);
  return (
    <div className="rrow">
      {cu && !broken ? <img src={cu} alt="" onError={() => setBroken(true)} /> : <div className="noc" />}
      <div className="ri">
        <div className="t">{b.title}</div>
        <div className="a">
          {b.authors || "Unknown"}
          {b.published ? " · " + b.published : ""}
          {b.language ? " · " + b.language : ""}
        </div>
      </div>
      <button className="btn primary" onClick={onAdd}>
        Add
      </button>
    </div>
  );
}

/* ---------------- CSV (bulk, direct to library) ---------------- */
function CsvTab({ shelves, onDone }) {
  const [msg, setMsg] = useState("");

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMsg("Parsing…");
    const text = await file.text();
    let parsed;
    try {
      parsed = parseBookCSV(text);
    } catch (err) {
      setMsg("Could not parse CSV: " + err.message);
      return;
    }
    // ensure shelves exist, map name -> id
    const existing = new Map(shelves.map((s) => [s.name.toLowerCase(), s.id]));
    const nameToId = {};
    for (const name of parsed.shelfNames) {
      const lower = name.toLowerCase();
      if (existing.has(lower)) nameToId[name] = existing.get(lower);
      else {
        try {
          const s = await db.addShelf(name);
          nameToId[name] = s.id;
          existing.set(lower, s.id);
        } catch {}
      }
    }
    let added = 0;
    for (const b of parsed.books) {
      try {
        const { book, created } = await db.addBook(b);
        if (created) added++;
        if (b.shelfNames && b.shelfNames.length) {
          const ids = b.shelfNames.map((n) => nameToId[n]).filter(Boolean);
          if (ids.length) await db.setBookShelves(book.id, ids);
        }
      } catch (e) {
        console.error(e);
      }
    }
    setMsg(`Imported ${added} books${parsed.shelfNames.size ? ` and matched ${parsed.shelfNames.size} shelves` : ""}.`);
    toast("Imported " + added + " books");
    onDone();
  }

  return (
    <div>
      <div className="field">
        <label>Import a CSV file</label>
        <input type="file" accept=".csv" onChange={onFile} />
      </div>
      <div className="note">
        Works with <b>both</b> a CSV exported from this app (Title, Author, Year, ISBN, Language) and a
        <b> Goodreads</b> export (My Books → Import and export → Export Library). From Goodreads it also maps
        rating, shelves, reading status &amp; review. Covers load by ISBN as you browse.
      </div>
      {msg && <div className="note" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

/* ---------------- Manual ---------------- */
function ManualTab({ onAdd }) {
  const [f, setF] = useState({ title: "", authors: "", isbn: "", published: "", language: "", status: "to_read" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  function add() {
    if (!f.title.trim()) return toast("Title required");
    const isbn = f.isbn.replace(/[^0-9Xx]/g, "");
    onAdd({
      title: f.title.trim(),
      authors: f.authors.trim(),
      status: f.status,
      language: f.language,
      isbn13: isbn.length === 13 ? isbn : "",
      isbn10: isbn.length === 10 ? isbn : "",
      published: f.published.trim(),
    });
    toast("Added to tray");
    setF({ title: "", authors: "", isbn: "", published: "", language: f.language, status: f.status });
  }

  return (
    <div>
      <div className="field">
        <label>Title</label>
        <input value={f.title} onChange={(e) => set("title", e.target.value)} />
      </div>
      <div className="field">
        <label>Authors</label>
        <input value={f.authors} onChange={(e) => set("authors", e.target.value)} />
      </div>
      <div className="row3">
        <div className="field">
          <label>ISBN (optional)</label>
          <input value={f.isbn} onChange={(e) => set("isbn", e.target.value)} />
        </div>
        <div className="field">
          <label>Year (optional)</label>
          <input value={f.published} onChange={(e) => set("published", e.target.value)} />
        </div>
        <div className="field">
          <label>Language</label>
          <select value={f.language} onChange={(e) => set("language", e.target.value)}>
            <option value="">—</option>
            {LANGS.map((l) => (
              <option key={l.code} value={l.name}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Status</label>
        <select value={f.status} onChange={(e) => set("status", e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s.k} value={s.k}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <button className="btn primary" onClick={add}>
        Add to tray
      </button>
    </div>
  );
}
