"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, X, ZoomIn } from "lucide-react";

const OUTPUT = 512;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function AvatarCrop({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void | Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => setError("Não foi possível abrir essa imagem.");
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function paint(target: HTMLCanvasElement) {
    if (!image) return;
    const size = target.width;
    const context = target.getContext("2d");
    if (!context) return;

    const scale = Math.max(size / image.width, size / image.height) * zoom;
    const width = image.width * scale;
    const height = image.height * scale;
    const maxX = Math.max(0, (width - size) / 2);
    const maxY = Math.max(0, (height - size) / 2);
    const x = (size - width) / 2 + clamp(offset.x, -maxX, maxX);
    const y = (size - height) / 2 + clamp(offset.y, -maxY, maxY);

    context.clearRect(0, 0, size, size);
    context.imageSmoothingQuality = "high";
    context.drawImage(image, x, y, width, height);
  }

  useEffect(() => {
    if (canvasRef.current) paint(canvasRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, zoom, offset]);

  function maxPan() {
    const canvas = canvasRef.current;
    if (!canvas || !image) return { x: 0, y: 0 };
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height) * zoom;
    return {
      x: Math.max(0, (image.width * scale - canvas.width) / 2),
      y: Math.max(0, (image.height * scale - canvas.height) / 2),
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const limit = maxPan();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = rect.width > 0 ? event.currentTarget.width / rect.width : 1;
    setOffset({
      x: clamp(drag.ox + (event.clientX - drag.x) * ratio, -limit.x, limit.x),
      y: clamp(drag.oy + (event.clientY - drag.y) * ratio, -limit.y, limit.y),
    });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  async function save() {
    if (!image) return;
    setSaving(true);
    setError(null);

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    paint(canvas);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92),
    );

    if (!blob) {
      setError("Não foi possível recortar a imagem.");
      setSaving(false);
      return;
    }

    await onDone(blob);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="animate-pop w-full max-w-sm rounded-2xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Ajustar foto</h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Cancelar ajuste"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-full bg-surface-2 ring-1 ring-line">
          <canvas
            ref={canvasRef}
            width={OUTPUT}
            height={OUTPUT}
            className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label="Área de recorte da foto"
          />
          <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/40" />
        </div>

        <label className="mt-4 flex items-center gap-2 text-xs text-muted">
          <ZoomIn size={14} />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="flex-1 accent-[var(--accent)]"
            aria-label="Zoom da foto"
          />
          <span className="w-9 text-right tabular-nums">{zoom.toFixed(1)}x</span>
        </label>

        <p className="mt-1 text-[0.68rem] text-muted">
          Arraste a imagem para enquadrar. O resultado vira um quadrado 1:1.
        </p>

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !image}
            className="btn btn-primary flex-1"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Usar foto
          </button>
        </div>
      </div>
    </div>
  );
}
