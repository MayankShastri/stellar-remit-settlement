import React, { useEffect, useRef } from "react";

export function CanvasBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let time = 0;
    const spacing = 7;
    const dotSize = 5;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    const drawField = () => {
      ctx.fillStyle = "#030303";
      ctx.fillRect(0, 0, width, height);

      time += reduceMotion ? 0.002 : 0.011;

      const centerX = width / 2;
      const archPeakY = height * 0.30;
      const archWidth = width * 1.45;
      const archHeight = height * 0.70;

      ctx.globalCompositeOperation = "lighter";

      for (let x = 0; x < width; x += spacing) {
        const normX = (x - centerX) / (archWidth / 2);
        const curveY = archPeakY + normX * normX * archHeight;

        for (let y = 0; y < height; y += spacing) {
          const distanceToCurve = Math.abs(y - curveY);
          const thickness = 120 + (1 - Math.min(1, Math.abs(normX))) * 75;

          if (distanceToCurve < thickness) {
            let intensity = 1 - distanceToCurve / thickness;
            const waveX = Math.sin(x * 0.014 + time);
            const waveY = Math.cos(y * 0.018 + time * 1.15);
            intensity = intensity * 0.72 + waveX * waveY * 0.24 * intensity;
            intensity *= Math.max(0, 1 - Math.pow(Math.abs(normX), 2.2));

            if (intensity > 0.03) {
              let lum = Math.min(255, 110 * intensity + 140 * Math.pow(intensity, 2));

              if (intensity > 0.70) {
                const coreBoost = (intensity - 0.70) * 3.2;
                lum = Math.min(255, lum + 140 * coreBoost);
              }

              const r = Math.floor(lum * 0.95);
              const g = Math.floor(lum * 0.98);
              const b = Math.floor(Math.min(255, lum * 1.05));

              ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
              const size = Math.max(0.8, dotSize * intensity);
              ctx.fillRect(x, y, size, size);
            }
          }
        }
      }

      ctx.globalCompositeOperation = "source-over";
      animationFrameId = requestAnimationFrame(drawField);
    };

    drawField();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 h-full w-full pointer-events-none"
      />
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(255,255,255,0.08) 0.0625rem, transparent 0.0625rem)",
          backgroundSize: "1.25rem 1.25rem",
        }}
      />
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.08), transparent 34rem), radial-gradient(circle at 85% 28%, rgba(255,255,255,0.03), transparent 28rem), linear-gradient(180deg, rgba(3,3,3,0.3), #030303 85%)",
        }}
      />
    </>
  );
}
