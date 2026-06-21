import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import App from "./App.jsx";
import SharePage from "./pages/SharePage.jsx";
import { applyTheme, storedTheme } from "./lib/themes.js";
import "./styles.css";

applyTheme(storedTheme());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/share/library/:slug" element={<SharePage kind="library" />} />
        <Route path="/share/shelf/:slug" element={<SharePage kind="shelf" />} />
        <Route
          path="/*"
          element={
            <AuthProvider>
              <App />
            </AuthProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
