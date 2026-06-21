import { useEffect } from "react";
import { computeStats, statusColor, STATUSES } from "../lib/books.js";

function Bars({ rows, max, color }) {
  return (
    <div className="stat-bars">
      {rows.map(([label, n]) => (
        <div className="stat-bar" key={label}>
          <span className="sb-label" title={label}>{label}</span>
          <span className="sb-track">
            <span
              className="sb-fill"
              style={{ width: max ? Math.round((n / max) * 100) + "%" : "0%", background: color || "var(--accent2)" }}
            />
          </span>
          <span className="sb-num">{n}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsModal({ books, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const s = computeStats(books);
  const statusRows = STATUSES.map((st) => [st.label, s.byStatus[st.k] || 0]);
  const statusMax = Math.max(1, ...statusRows.map((r) => r[1]));
  const langMax = Math.max(1, ...s.topLangs.map((r) => r[1]));
  const authorMax = Math.max(1, ...s.topAuthors.map((r) => r[1]));

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Library statistics" style={{ maxWidth: 560 }}>
        <div className="mh">
          <h3>Library at a glance</h3>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="body">
          <div className="stat-cards">
            <div className="stat-card"><div className="sc-num">{s.total}</div><div className="sc-label">Total books</div></div>
            <div className="stat-card"><div className="sc-num">{s.readThisYear}</div><div className="sc-label">Read in {new Date().getFullYear()}</div></div>
            <div className="stat-card"><div className="sc-num">{s.avgRating ? s.avgRating.toFixed(1) : "—"}</div><div className="sc-label">Avg rating ({s.ratedCount})</div></div>
            <div className="stat-card"><div className="sc-num">{s.loan.lent + s.loan.borrowed}</div><div className="sc-label">On loan ({s.loan.lent} out / {s.loan.borrowed} in)</div></div>
          </div>

          <h4 className="stat-h">By status</h4>
          <div className="stat-bars">
            {statusRows.map(([label, n], i) => (
              <div className="stat-bar" key={label}>
                <span className="sb-label">{label}</span>
                <span className="sb-track">
                  <span className="sb-fill" style={{ width: Math.round((n / statusMax) * 100) + "%", background: statusColor(STATUSES[i].k) }} />
                </span>
                <span className="sb-num">{n}</span>
              </div>
            ))}
          </div>

          {!!s.topAuthors.length && (
            <>
              <h4 className="stat-h">Most-shelved authors</h4>
              <Bars rows={s.topAuthors} max={authorMax} color="var(--accent)" />
            </>
          )}

          {!!s.topLangs.length && (
            <>
              <h4 className="stat-h">By language</h4>
              <Bars rows={s.topLangs.slice(0, 8)} max={langMax} color="var(--accent2)" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
