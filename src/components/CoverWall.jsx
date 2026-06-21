import { useRef, useState } from "react";
import BookCard from "./BookCard.jsx";

// ids to drag: if dragging a selected card in select mode, carry the whole selection
export function dragIdsFor(book, selectMode, selected) {
  if (selectMode && selected && selected.has(book.id) && selected.size > 1) return [...selected];
  return [book.id];
}

export default function CoverWall({ books, canReorder, onOpen, onReorder, selectMode, selected, onToggleSelect }) {
  const dragId = useRef(null);
  const [over, setOver] = useState(null);

  if (!books.length) {
    return (
      <div className="empty">
        <h3>Nothing here yet</h3>
        <p>Use “+ Add books” to scan barcodes, look up ISBNs, search a catalog, or import a CSV.</p>
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
    <div className="wall">
      {books.map((b) => (
        <BookCard
          key={b.id}
          book={b}
          onOpen={onOpen}
          selectMode={selectMode}
          selected={selected?.has(b.id)}
          onToggleSelect={onToggleSelect}
          draggable
          dragProps={{
            onDragStart: (e) => {
              dragId.current = b.id;
              e.dataTransfer.effectAllowed = "copyMove";
              e.dataTransfer.setData(
                "application/book-ids",
                JSON.stringify(dragIdsFor(b, selectMode, selected))
              );
            },
            onDragOver: canReorder
              ? (e) => {
                  e.preventDefault();
                  setOver(b.id);
                }
              : undefined,
            onDragLeave: canReorder ? () => setOver((o) => (o === b.id ? null : o)) : undefined,
            onDrop: canReorder
              ? (e) => {
                  e.preventDefault();
                  drop(b.id);
                }
              : undefined,
            className: over === b.id ? "dragover" : undefined,
          }}
        />
      ))}
    </div>
  );
}
