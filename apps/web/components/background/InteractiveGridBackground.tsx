"use client";

import { useEffect, useRef } from "react";

type ActiveCell = {
  col: number;
  row: number;
  energy: number;
  hue: number;
};

type ThemeProfile = {
  gridLine: string;
  gridMajor: string;
  glowAlpha: number;
  cellAlpha: number;
  cellLightness: number;
};

const CELL_SIZE = 30;
const MAJOR_GRID_EVERY = 5;
const MAX_ACTIVE_CELLS = 240;
const AMBIENT_INTERVAL_MS = 520;
const COLOR_HUES = [8, 45, 154, 214, 265, 334] as const;

const DARK_PROFILE: ThemeProfile = {
  gridLine: "rgba(125, 145, 140, 0.08)",
  gridMajor: "rgba(172, 192, 186, 0.14)",
  glowAlpha: 0.17,
  cellAlpha: 0.56,
  cellLightness: 70,
};

const LIGHT_PROFILE: ThemeProfile = {
  gridLine: "rgba(64, 94, 84, 0.08)",
  gridMajor: "rgba(64, 94, 84, 0.16)",
  glowAlpha: 0.1,
  cellAlpha: 0.34,
  cellLightness: 56,
};

const getThemeProfile = () => {
  if (typeof window === "undefined") {
    return DARK_PROFILE;
  }

  const explicitTheme = document.documentElement.dataset.theme;
  const isDark =
    explicitTheme === "dark" ||
    (explicitTheme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return isDark ? DARK_PROFILE : LIGHT_PROFILE;
};

export default function InteractiveGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let lastFrameTime = performance.now();
    let hueIndex = 0;
    let reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let profile = getThemeProfile();

    const activeCells = new Map<string, ActiveCell>();
    const pointer = {
      x: 0,
      y: 0,
      seen: false,
    };

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = false;
    };

    const clampHue = (value: number) => {
      if (value < 0) return value + 360;
      if (value >= 360) return value - 360;
      return value;
    };

    const ensureCellLimit = () => {
      if (activeCells.size <= MAX_ACTIVE_CELLS) return;
      const trim = activeCells.size - MAX_ACTIVE_CELLS;
      const sorted = [...activeCells.entries()].sort(
        (left, right) => left[1].energy - right[1].energy,
      );

      for (let index = 0; index < trim; index += 1) {
        const candidate = sorted[index];
        if (!candidate) break;
        activeCells.delete(candidate[0]);
      }
    };

    const energizeCell = (col: number, row: number, energy: number) => {
      if (col < 0 || row < 0) return;
      const maxCols = Math.ceil(width / CELL_SIZE);
      const maxRows = Math.ceil(height / CELL_SIZE);
      if (col >= maxCols || row >= maxRows) return;

      const key = `${col}:${row}`;
      const existing = activeCells.get(key);
      const baseHue = COLOR_HUES[hueIndex % COLOR_HUES.length] ?? COLOR_HUES[0];
      const hue = clampHue(baseHue + (Math.random() * 24 - 12));

      if (existing) {
        existing.energy = Math.min(1, Math.max(existing.energy, energy));
        existing.hue = clampHue(existing.hue * 0.66 + hue * 0.34);
      } else {
        activeCells.set(key, {
          col,
          row,
          energy: Math.min(1, energy),
          hue,
        });
      }

      hueIndex += 1;
      ensureCellLimit();
    };

    const drawTrail = (
      fromX: number,
      fromY: number,
      toX: number,
      toY: number,
      energy = 0.95,
    ) => {
      const fromCol = Math.floor(fromX / CELL_SIZE);
      const fromRow = Math.floor(fromY / CELL_SIZE);
      const toCol = Math.floor(toX / CELL_SIZE);
      const toRow = Math.floor(toY / CELL_SIZE);

      const colDistance = Math.abs(toCol - fromCol);
      const rowDistance = Math.abs(toRow - fromRow);
      const steps = Math.max(colDistance, rowDistance, 1);

      for (let step = 0; step <= steps; step += 1) {
        const progress = step / steps;
        const col = Math.round(fromCol + (toCol - fromCol) * progress);
        const row = Math.round(fromRow + (toRow - fromRow) * progress);
        const strength = Math.max(0.18, energy - progress * 0.42);
        energizeCell(col, row, strength);
      }
    };

    const drawGrid = () => {
      context.beginPath();
      context.strokeStyle = profile.gridLine;
      context.lineWidth = 1;

      for (let x = 0; x <= width; x += CELL_SIZE) {
        const line = Math.round(x) + 0.5;
        context.moveTo(line, 0);
        context.lineTo(line, height);
      }

      for (let y = 0; y <= height; y += CELL_SIZE) {
        const line = Math.round(y) + 0.5;
        context.moveTo(0, line);
        context.lineTo(width, line);
      }

      context.stroke();

      context.beginPath();
      context.strokeStyle = profile.gridMajor;
      context.lineWidth = 1;
      const majorStep = CELL_SIZE * MAJOR_GRID_EVERY;

      for (let x = 0; x <= width; x += majorStep) {
        const line = Math.round(x) + 0.5;
        context.moveTo(line, 0);
        context.lineTo(line, height);
      }

      for (let y = 0; y <= height; y += majorStep) {
        const line = Math.round(y) + 0.5;
        context.moveTo(0, line);
        context.lineTo(width, line);
      }

      context.stroke();
    };

    const drawPointerGlow = () => {
      if (!pointer.seen || reducedMotion) return;

      const radius = CELL_SIZE * 6;
      const gradient = context.createRadialGradient(
        pointer.x,
        pointer.y,
        0,
        pointer.x,
        pointer.y,
        radius,
      );

      gradient.addColorStop(0, `rgba(255, 255, 255, ${profile.glowAlpha})`);
      gradient.addColorStop(
        0.4,
        `rgba(97, 175, 255, ${profile.glowAlpha * 0.56})`,
      );
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      context.fillStyle = gradient;
      context.fillRect(
        pointer.x - radius,
        pointer.y - radius,
        radius * 2,
        radius * 2,
      );
    };

    const drawActiveCells = (deltaSeconds: number) => {
      const decay = reducedMotion ? 2.9 : 1.7;

      for (const [key, cell] of activeCells) {
        cell.energy -= decay * deltaSeconds;
        if (cell.energy <= 0.02) {
          activeCells.delete(key);
          continue;
        }

        const inset = 1.2;
        const size = CELL_SIZE - inset * 2;
        const alpha = Math.max(
          0.03,
          Math.min(1, cell.energy) * profile.cellAlpha,
        );

        context.fillStyle = `hsla(${cell.hue}, 90%, ${profile.cellLightness}%, ${alpha})`;
        context.fillRect(
          cell.col * CELL_SIZE + inset,
          cell.row * CELL_SIZE + inset,
          size,
          size,
        );

        if (cell.energy > 0.42) {
          const coreInset = inset + CELL_SIZE * 0.2;
          const coreSize = CELL_SIZE - coreInset * 2;
          context.fillStyle = `hsla(${cell.hue}, 96%, ${profile.cellLightness + 10}%, ${
            alpha * 0.5
          })`;
          context.fillRect(
            cell.col * CELL_SIZE + coreInset,
            cell.row * CELL_SIZE + coreInset,
            coreSize,
            coreSize,
          );
        }
      }
    };

    const render = (timestamp: number) => {
      const deltaSeconds = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
      lastFrameTime = timestamp;

      context.clearRect(0, 0, width, height);
      drawGrid();
      drawPointerGlow();
      drawActiveCells(deltaSeconds);

      animationFrame = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const { clientX, clientY } = event;

      if (!pointer.seen) {
        pointer.seen = true;
        pointer.x = clientX;
        pointer.y = clientY;
        drawTrail(clientX, clientY, clientX, clientY, 1);
        return;
      }

      drawTrail(pointer.x, pointer.y, clientX, clientY, 0.94);
      pointer.x = clientX;
      pointer.y = clientY;
    };

    const handlePointerDown = (event: PointerEvent) => {
      const { clientX, clientY } = event;
      pointer.seen = true;
      pointer.x = clientX;
      pointer.y = clientY;

      const centerCol = Math.floor(clientX / CELL_SIZE);
      const centerRow = Math.floor(clientY / CELL_SIZE);

      energizeCell(centerCol, centerRow, 1);
      energizeCell(centerCol + 1, centerRow, 0.6);
      energizeCell(centerCol - 1, centerRow, 0.6);
      energizeCell(centerCol, centerRow + 1, 0.6);
      energizeCell(centerCol, centerRow - 1, 0.6);
    };

    const handleReducedMotion = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };

    const reducedMotionMedia = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    reducedMotionMedia.addEventListener("change", handleReducedMotion);

    const colorSchemeMedia = window.matchMedia("(prefers-color-scheme: dark)");
    const handleColorSchemeChange = () => {
      profile = getThemeProfile();
    };
    colorSchemeMedia.addEventListener("change", handleColorSchemeChange);

    const themeObserver = new MutationObserver(() => {
      profile = getThemeProfile();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });

    resizeCanvas();
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      reducedMotionMedia.removeEventListener("change", handleReducedMotion);
      colorSchemeMedia.removeEventListener("change", handleColorSchemeChange);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <div className="app-background" aria-hidden="true">
      <canvas ref={canvasRef} className="app-background-canvas" />
      <div className="app-background-vignette" />
    </div>
  );
}
