"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";

type Mode = "daily" | "casual" | "multiplayer";

type GameHeaderProps = {
  mode: Mode;
  title?: string;
  statsPanel?: ReactNode;
  statsTitle?: string;
  settingsPanel?: ReactNode;
  settingsTitle?: string;
};

type PanelKey = "stats" | "settings" | null;

const modeLinks: Array<{
  key: Mode;
  label: string;
  href?: string;
}> = [
  { key: "daily", label: "Daily", href: "/" },
  { key: "casual", label: "Casual", href: "/casual" },
  { key: "multiplayer", label: "Multiplayer" },
];

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M4 19h16v2H2V3h2v16zm4-2H6V9h2v8zm5 0h-2V5h2v12zm5 0h-2v-6h2v6z"
    />
  </svg>
);

const CogIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.8a.5.5 0 0 0 .12.64l2.03 1.58c-.04.3-.06.62-.06.94s.02.64.06.94L2.82 14.5a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
    />
  </svg>
);

export default function GameHeader({
  mode,
  title = "Blocker Rush",
  statsPanel,
  statsTitle = "Stats",
  settingsPanel,
  settingsTitle = "Settings",
}: GameHeaderProps) {
  const [openPanel, setOpenPanel] = useState<PanelKey>(null);

  useEffect(() => {
    if (!openPanel) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openPanel]);

  const togglePanel = (panel: Exclude<PanelKey, null>) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  const activePanel =
    openPanel === "stats" ? statsPanel : openPanel === "settings" ? settingsPanel : null;

  const activeTitle =
    openPanel === "stats" ? statsTitle : openPanel === "settings" ? settingsTitle : "";

  return (
    <>
      <header className="game-header">
        <div className="header-left">
          <span className="game-title">{title}</span>
        </div>
        <div className="header-center">
          <div className="mode-switch" role="tablist" aria-label="Game mode">
            {modeLinks.map((item) =>
              item.href ? (
                <Link
                  key={item.key}
                  className={[
                    "mode-button",
                    mode === item.key ? "active" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  href={item.href}
                  role="tab"
                  aria-selected={mode === item.key}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.key}
                  className={[
                    "mode-button",
                    mode === item.key ? "active" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  disabled
                  aria-disabled="true"
                >
                  {item.label}
                </button>
              ),
            )}
          </div>
        </div>
        <div className="header-actions">
          {statsPanel && (
            <button
              className={[
                "icon-button",
                openPanel === "stats" ? "active" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              onClick={() => togglePanel("stats")}
              aria-label="Open stats"
              aria-expanded={openPanel === "stats"}
            >
              <ChartIcon />
            </button>
          )}
          {settingsPanel && (
            <button
              className={[
                "icon-button",
                openPanel === "settings" ? "active" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              onClick={() => togglePanel("settings")}
              aria-label="Open settings"
              aria-expanded={openPanel === "settings"}
            >
              <CogIcon />
            </button>
          )}
        </div>
      </header>
      {openPanel && activePanel && (
        <div
          className="header-modal-backdrop"
          role="presentation"
          onClick={() => setOpenPanel(null)}
        >
          <div
            className="header-modal"
            role="dialog"
            aria-modal="true"
            aria-label={activeTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="header-modal-header">
              <h3 className="modal-title">{activeTitle}</h3>
              <button
                className="icon-button modal-close"
                type="button"
                onClick={() => setOpenPanel(null)}
                aria-label="Close panel"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    fill="currentColor"
                    d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.7 2.88 18.29 9.17 12 2.88 5.71 4.29 4.3 10.59 10.6l6.3-6.3z"
                  />
                </svg>
              </button>
            </div>
            <div className="header-modal-body">{activePanel}</div>
          </div>
        </div>
      )}
    </>
  );
}
