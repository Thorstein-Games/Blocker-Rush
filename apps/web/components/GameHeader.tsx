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

type PanelKey = "stats" | "settings" | "howToPlay" | null;

const modeLinks: Array<{
  key: Mode;
  label: string;
  href?: string;
}> = [
  { key: "daily", label: "Daily", href: "/" },
  { key: "casual", label: "Casual", href: "/casual" },
  { key: "multiplayer", label: "Multiplayer", href: "/multiplayer" },
];

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="currentColor"
      d="M4 19h16v2H2V3h2v16zm4-2H6V9h2v8zm5 0h-2V5h2v12zm5 0h-2v-6h2v6z"
    />
  </svg>
);

// viewBox="0 0 24 24"
const CogIcon = () => (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    height="21"
    viewBox="2 2 28 28"
    width="21"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M26.8666 17.3372C26.918 16.9086 26.9523 16.4629 26.9523 16C26.9523 15.5371 26.918 15.0914 26.8494 14.6628L29.7466 12.3999C30.0038 12.1942 30.0724 11.8171 29.9181 11.5256L27.1752 6.77693C27.0037 6.46836 26.6437 6.3655 26.3351 6.46836L22.9236 7.83982C22.2036 7.29123 21.4493 6.84551 20.6093 6.50264L20.095 2.86827C20.0436 2.52541 19.7521 2.2854 19.4093 2.2854H13.9234C13.5806 2.2854 13.3063 2.52541 13.2548 2.86827L12.7405 6.50264C11.9005 6.84551 11.1291 7.30838 10.4262 7.83982L7.01469 6.46836C6.70611 6.34835 6.3461 6.46836 6.17467 6.77693L3.43175 11.5256C3.26031 11.8342 3.32889 12.1942 3.60318 12.3999L6.50039 14.6628C6.43182 15.0914 6.38039 15.5543 6.38039 16C6.38039 16.4457 6.41467 16.9086 6.48325 17.3372L3.58603 19.6001C3.32889 19.8058 3.26031 20.183 3.4146 20.4744L6.15752 25.2231C6.32896 25.5317 6.68896 25.6345 6.99754 25.5317L10.4091 24.1602C11.1291 24.7088 11.8834 25.1545 12.7234 25.4974L13.2377 29.1317C13.3063 29.4746 13.5806 29.7146 13.9234 29.7146H19.4093C19.7521 29.7146 20.0436 29.4746 20.0779 29.1317L20.5921 25.4974C21.4322 25.1545 22.2036 24.6916 22.9065 24.1602L26.318 25.5317C26.6266 25.6517 26.9866 25.5317 27.158 25.2231L29.9009 20.4744C30.0724 20.1658 30.0038 19.8058 29.7295 19.6001L26.8666 17.3372V17.3372ZM16.6663 21.143C13.8377 21.143 11.5234 18.8286 11.5234 16C11.5234 13.1714 13.8377 10.857 16.6663 10.857C19.495 10.857 21.8093 13.1714 21.8093 16C21.8093 18.8286 19.495 21.143 16.6663 21.143Z"
    ></path>
  </svg>
);

const HelpIcon = () => (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    height="22"
    viewBox="2 2 28 28"
    width="22"
  >
    <path
      fill="currentColor"
      d="M15 24H17.6667V21.3333H15V24ZM16.3333 2.66666C8.97333 2.66666 3 8.63999 3 16C3 23.36 8.97333 29.3333 16.3333 29.3333C23.6933 29.3333 29.6667 23.36 29.6667 16C29.6667 8.63999 23.6933 2.66666 16.3333 2.66666ZM16.3333 26.6667C10.4533 26.6667 5.66667 21.88 5.66667 16C5.66667 10.12 10.4533 5.33332 16.3333 5.33332C22.2133 5.33332 27 10.12 27 16C27 21.88 22.2133 26.6667 16.3333 26.6667ZM16.3333 7.99999C13.3867 7.99999 11 10.3867 11 13.3333H13.6667C13.6667 11.8667 14.8667 10.6667 16.3333 10.6667C17.8 10.6667 19 11.8667 19 13.3333C19 16 15 15.6667 15 20H17.6667C17.6667 17 21.6667 16.6667 21.6667 13.3333C21.6667 10.3867 19.28 7.99999 16.3333 7.99999Z"
    ></path>
  </svg>
);

const howToPlayPanel = (
  <div className="stack">
    <div className="stack">
      <strong>Rules</strong>
      <span>
        Each puzzle gives you 7 blockers on a 6x6 grid. Your goal is to place
        all 9 pieces so every remaining square is filled. Pieces can be rotated
        and flipped, but they cannot overlap or cover blockers.
      </span>
    </div>
    <div className="stack">
      <strong>Interactions</strong>
      <ul>
        <li>Click or tap a piece to make it active.</li>
        <li>Click an active piece again to rotate it.</li>
        <li>Drag a piece onto the board to place it.</li>
        <li>Click an empty board cell to place the active piece there.</li>
        <li>
          Drag a placed piece to move it, or drag it off the board to remove it.
        </li>
        <li>Double-click a placed piece to remove it.</li>
        <li>
          Use the Rotate/Flip buttons, or press W/S to rotate and A/D to flip.
        </li>
      </ul>
    </div>
    <div className="stack">
      <strong>Modes</strong>
      <ul>
        <li>
          Daily gives everyone the same puzzle each day and tracks streaks.
        </li>
        <li>
          Casual lets you pick difficulty, generate random puzzles, or load a
          specific puzzle ID
        </li>
        <li>Multiplayer is a live race with synchronized rounds.</li>
      </ul>
    </div>
  </div>
);
const howToPlayTitle = "How to Play";

export default function GameHeader({
  mode,
  title = "Blocker Rush",
  statsPanel,
  statsTitle = "Stats",
  settingsPanel,
  settingsTitle = "Settings",
}: GameHeaderProps) {
  const [openPanel, setOpenPanel] = useState<PanelKey>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!openPanel && !isMenuOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPanel(null);
        setIsMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openPanel, isMenuOpen]);

  const togglePanel = (panel: Exclude<PanelKey, null>) => {
    setOpenPanel((current) => (current === panel ? null : panel));
    setIsMenuOpen(false);
  };

  const activePanel =
    openPanel === "stats"
      ? statsPanel
      : openPanel === "settings"
        ? settingsPanel
        : openPanel === "howToPlay"
          ? howToPlayPanel
          : null;

  const activeTitle =
    openPanel === "stats"
      ? statsTitle
      : openPanel === "settings"
        ? settingsTitle
        : openPanel === "howToPlay"
          ? howToPlayTitle
          : "";

  const handleMenuToggle = () => {
    setIsMenuOpen((current) => !current);
    setOpenPanel(null);
  };

  const handleMenuLinkClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      <header className="game-header">
        <div className="header-left">
          <button
            className={[
              "icon-button",
              "header-menu-toggle",
              isMenuOpen ? "active" : null,
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            onClick={handleMenuToggle}
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"
              />
            </svg>
          </button>
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
          {howToPlayPanel && (
            <button
              className={[
                "icon-button",
                openPanel === "howToPlay" ? "active" : null,
              ]
                .filter(Boolean)
                .join(" ")}
              type="button"
              onClick={() => togglePanel("howToPlay")}
              aria-label="Open how to play"
              aria-expanded={openPanel === "howToPlay"}
            >
              <HelpIcon />
            </button>
          )}
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
      {isMenuOpen && (
        <div className="header-menu" role="menu" aria-label="Game menu">
          <div className="header-menu-card">
            <div className="header-menu-section">
              {modeLinks.map((item) =>
                item.href ? (
                  <Link
                    key={item.key}
                    className={[
                      "menu-link",
                      mode === item.key ? "active" : null,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    href={item.href}
                    role="menuitem"
                    onClick={handleMenuLinkClick}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.key}
                    className="menu-link"
                    type="button"
                    disabled
                    aria-disabled="true"
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>
            {(statsPanel || settingsPanel || howToPlayPanel) && (
              <div className="header-menu-section">
                {statsPanel && (
                  <button
                    className="menu-link"
                    type="button"
                    onClick={() => togglePanel("stats")}
                  >
                    {statsTitle}
                  </button>
                )}
                {settingsPanel && (
                  <button
                    className="menu-link"
                    type="button"
                    onClick={() => togglePanel("settings")}
                  >
                    {settingsTitle}
                  </button>
                )}
                {howToPlayPanel && (
                  <button
                    className="menu-link"
                    type="button"
                    onClick={() => togglePanel("howToPlay")}
                  >
                    {howToPlayTitle}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
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
