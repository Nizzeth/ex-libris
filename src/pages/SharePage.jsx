import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import * as db from "../lib/db.js";
import { filterBooks, distinctLanguages, STATUSES } from "../lib/books.js";
import BookCard from "../components/BookCard.jsx";
import "../styles.css";

export default function SharePage({ kind }) {
  const { slug } = useParams();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [language, setLanguage] = useState(null);
  const [status, setStatus] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = kind === "library" ? await db.getPublicLibrary(slug) : await db.getPublicShelf(slug);
        if (!cancelled) setState({ loading: false, data, error: null });
      } catch (e) {
        if (!cancelled) setState({ loading: false, data: null, error: e.message || "Error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, slug]);

  const books = state.data?.books || [];
  const langs = useMemo(() => distinctLanguages(books), [books]);
  const shown = useMemo(
    () => filterBooks(books, { language, status, search, sort: "manual" }),
    [books, language, status, search]
  );

  if (state.loading)
    return (
      <div className="center">
        <span className="spin" />
      </div>
    );

  if (!state.data)
    return (
      <div className="center">
        <div className="authcard">
          <h1>Not found</h1>
          <p>This collection is private or the link is no longer valid.</p>
        </div>
      </div>
    );

  const title =
    kind === "library"
      ? `${state.data.profile.display_name || "A reader"}’s library`
      : state.data.shelf.name;
  const by = kind === "library" ? "Shared library" : `Shelf shared by ${state.data.owner}`;

  return (
    <div>
      <div className="sharehead">
        <h1>{title}</h1>
        <div className="by">{by} · {books.length} books</div>
        <div className="sharefilters">
          <input
            className="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {STATUSES.map((s) => (
            <button
              key={s.k}
              className={"tag" + (status === s.k ? " sel" : "")}
              onClick={() => setStatus(status === s.k ? null : s.k)}
            >
              {s.label}
            </button>
          ))}
          {langs.map((l) => (
            <button
              key={l}
              className={"tag" + (language === l ? " sel" : "")}
              onClick={() => setLanguage(language === l ? null : l)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <main style={{ maxWidth: 1100, margin: "0 auto" }}>
        {shown.length ? (
          <div className="wall">
            {shown.map((b) => (
              <BookCard key={b.id} book={b} readOnly />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>No books match</h3>
          </div>
        )}
      </main>
      <div className="note" style={{ textAlign: "center", padding: "24px" }}>
        Made with Ex Libris
      </div>
    </div>
  );
}
