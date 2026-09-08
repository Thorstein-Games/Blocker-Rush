"use client";

import { useEffect, useRef } from "react";

type WinnerFireworksProps = {
  className?: string;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
};

const COLORS = [
  "#ffd24f",
  "#47e5b3",
  "#4d8bff",
  "#ff7db2",
  "#ff8f3f",
  "#f4f7fb",
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function WinnerFireworks({ className }: WinnerFireworksProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let burstTimer = 0;
    let lastTick = performance.now();
    const startTime = performance.now();
    const particles: Particle[] = [];

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnBurst = (x: number, y: number, count: number) => {
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.3 + Math.random() * 3.8;
        const maxLife = 50 + Math.random() * 30;
        const color =
          COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#f4f7fb";
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (0.8 + Math.random() * 1.2),
          life: maxLife,
          maxLife,
          size: 2 + Math.random() * 3.2,
          color,
        });
      }
    };

    const animate = (timestamp: number) => {
      if (timestamp - startTime >= 5000) {
        ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        ctx.globalAlpha = 1;
        return;
      }

      const dt = clamp((timestamp - lastTick) / 16.67, 0.4, 2.2);
      lastTick = timestamp;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);

      burstTimer += dt;
      if (burstTimer >= 18) {
        const burstX = width * (0.2 + Math.random() * 0.6);
        const burstY = height * (0.15 + Math.random() * 0.45);
        spawnBurst(burstX, burstY, 24 + Math.floor(Math.random() * 14));
        burstTimer = 0;
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        if (!particle) continue;
        particle.life -= dt;

        if (particle.life <= 0) {
          particles.splice(index, 1);
          continue;
        }

        particle.vy += 0.075 * dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        const alpha = clamp(particle.life / particle.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      raf = window.requestAnimationFrame(animate);
    };

    const stopForReducedMotion = () => {
      if (!motion.matches) return;
      window.cancelAnimationFrame(raf);
      particles.length = 0;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    };
    motion.addEventListener("change", stopForReducedMotion);
    resize();
    spawnBurst(canvas.clientWidth * 0.33, canvas.clientHeight * 0.3, 36);
    spawnBurst(canvas.clientWidth * 0.67, canvas.clientHeight * 0.24, 32);
    raf = window.requestAnimationFrame(animate);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(raf);
      motion.removeEventListener("change", stopForReducedMotion);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
