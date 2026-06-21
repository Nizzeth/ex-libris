import { useState } from "react";
import { coverUrl, langCode, statusColor, statusLabel, LOANS, isOnLoan } from "../lib/books.js";

export default function BookCard({ book, readOnly, onOpen, draggable, dragProps, selectMode, selected, onToggleSelect }) {
  const [broken, setBroken] = useState(false);
  const cu = coverUrl(book);
  const { className: extra, ...rest } = dragProps || {};
  const cls = ["card", readOnly ? "ro" : "", selected ? "sel" : "", extra || ""].filter(Boolean).join(" ");
  const handleClick = () => {
    if (selectMode) onToggleSelect?.(book.id);
    else onOpen?.(book.id);
  };
  return (
    <div className={cls} draggable={draggable} onClick={handleClick} {...rest}>
      <div className="cover">
        {cu && !broken ? (
          <img src={cu} alt="" onError={() => setBroken(true)} />
        ) : (
          <div className="ph">{book.title || "No cover"}</div>
        )}
        {selectMode && <span className={"selcheck" + (selected ? " on" : "")}>{selected ? "✓" : ""}</span>}
        {!selectMode && isOnLoan(book) && (
          <span
            className={"loan-ribbon " + book.loan_status}
            title={LOANS[book.loan_status].label + (book.loan_party ? " · " + book.loan_party : "")}
          >
            {LOANS[book.loan_status].short}
          </span>
        )}
        <span className="status-dot" style={{ background: statusColor(book.status) }} title={statusLabel(book.status)} />
        {book.language && <span className="lang-badge">{langCode(book.language)}</span>}
      </div>
      <div className="meta">
        <div className="bt">{book.title || "Untitled"}</div>
        <div className="ba">{book.authors || "Unknown"}</div>
        {!!(book.tags && book.tags.length) && (
          <div className="btags">
            {book.tags.slice(0, 3).map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
