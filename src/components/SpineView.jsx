import { useRef, useState } from "react";
import { authorLastName, statusColor, STATUSES, LOANS, isOnLoan } from "../lib/books.js";
import { dragIdsFor } from "./CoverWall.jsx";

// Darken/lighten a #hex by a factor (<1 darker, >1 lighter) -> "rgb(...)".
function shade(hex, f) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const a = (x) => Math.max(0, Math.min(255, Math.round(x * f)));
  return `rgb(${a(r)},${a(g)},${a(b)})`;
}

// Spine leather is dyed by reading status; width grows so the full title fits.
function spineStyle(book) {
  const c = statusColor(book.status);
  const title = book.title || "";
  const lines = Math.min(3, Math.max(1, Math.ceil((title.length * 8.2) / 150)));
  const width = 30 + lines * 18; // 48 / 66 / 84px
  return {
    width,
    "--spine": c,
    "--spine-d": shade(c, 0.68),
    "--spine-dd": shade(c, 0.5),
    "--spine-l": shade(c, 1.2),
  };
}

export default function SpineView({ books, onOpen, selectMode, selected, onToggleSelect, canReorder, onReorder }) {
  const dragId = useRef(null);
  const [over, setOver] = useState(null);

  if (!books.length) {
    return (
      <div className="empty">
        <h3>Nothing here yet</h3>
        <p>Use “+ Add books” to start filling your shelf.</p>
      </div>
    );
  }

  function drop(targetId) {
    const from = dragId.current;
    setOver(null);
    dragId.current = null;
    if (!canReorder || !from || from === targetId) return;
    const ids = books.map((b) => b.id);
    const fi = ids.indexOf(from);
    const ti = ids.indexOf(targetId);
    if (fi < 0 || ti < 0) return;
    ids.splice(ti, 0, ids.splice(fi, 1)[0]);
    onReorder(ids);
  }

  return (
    <div className="shelfview">
      <div className="spine-legend">
        {STATUSES.map((s) => (
          <span key={s.k}>
            <i style={{ background: s.c }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="spines">
        {books.map((b) => {
          const isSel = selected?.has(b.id);
          return (
            <div
              key={b.id}
              className={"spine" + (isSel ? " sel" : "") + (over === b.id ? " dragover" : "")}
              style={spineStyle(b)}
              title={`${b.title} — ${b.authors || "Unknown"}`}
              draggable
              onClick={() => (selectMode ? onToggleSelect?.(b.id) : onOpen?.(b.id))}
              onDragStart={(e) => {
                dragId.current = b.id;
                e.dataTransfer.effectAllowed = "copyMove";
                e.dataTransfer.setData("application/book-ids", JSON.stringify(dragIdsFor(b, selectMode, selected)));
              }}
              onDragOver={canReorder ? (e) => { e.preventDefault(); setOver(b.id); } : undefined}
              onDragLeave={canReorder ? () => setOver((o) => (o === b.id ? null : o)) : undefined}
              onDrop={canReorder ? (e) => { e.preventDefault(); drop(b.id); } : undefined}
            >
              {!selectMode && isOnLoan(b) && (
                <span className={"spine-loan " + b.loan_status} title={LOANS[b.loan_status].label}>
                  {LOANS[b.loan_status].icon}
                </span>
              )}
              <span className="spine-title">{b.title || "Untitled"}</span>
              <span className="spine-author">{authorLastName(b.authors)}</span>
              {selectMode && <span className={"selcheck" + (isSel ? " on" : "")}>{isSel ? "✓" : ""}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
