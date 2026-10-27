import { computeFit, StudioError } from '@bookklik/device-mockup-studio-core';
import type { Fit } from '@bookklik/device-mockup-studio-core';
import { sourceSize } from './assets.js';

export type StudioCanvas = HTMLCanvasElement | OffscreenCanvas;
export type CanvasFactory = (width: number, height: number) => StudioCanvas;
export const MAX_OUTPUT_SIDE = 8192;
export const MAX_OUTPUT_PIXELS = 32_000_000;
export const clamp = (value: number, low = 0, high = 1): number => Math.max(low, Math.min(high, Number.isFinite(value) ? value : low));

export function dimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > MAX_OUTPUT_SIDE || height > MAX_OUTPUT_SIDE || width * height > MAX_OUTPUT_PIXELS) {
    throw new StudioError('OUTPUT_LIMIT', `Canvas dimensions must be positive, at most ${MAX_OUTPUT_SIDE}px per side and 32 megapixels total.`);
  }
}

export function defaultCanvasFactory(width: number, height: number): StudioCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas; }
  throw new StudioError('CANVAS_FACTORY', 'Supply canvasFactory when rendering outside a browser.');
}

export function context(canvas: StudioCanvas): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) throw new StudioError('CANVAS_CONTEXT', 'Canvas2D context is not available.');
  return ctx;
}

export function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = clamp(radius, 0, Math.min(width, height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r); ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

export function fitted(ctx: CanvasRenderingContext2D, source: CanvasImageSource, x: number, y: number, width: number, height: number, fit: Fit, focalX = 0.5, focalY = 0.5): void {
  if (width <= 0 || height <= 0) return;
  const { width: sw, height: sh } = sourceSize(source);
  const rect = computeFit(sw, sh, width, height, fit, focalX, focalY);
  ctx.drawImage(source, rect.sx, rect.sy, rect.sw, rect.sh, x + rect.dx, y + rect.dy, rect.dw, rect.dh);
}

export interface Point { x: number; y: number }
export interface MeshPoint extends Point { u: number; v: number }

/** Map an image-space triangle to an arbitrary screen-space triangle using an affine texture transform. */
export function texturedTriangle(ctx: CanvasRenderingContext2D, source: CanvasImageSource, a: MeshPoint, b: MeshPoint, c: MeshPoint, seam: number): void {
  const den = a.u * (b.v - c.v) + b.u * (c.v - a.v) + c.u * (a.v - b.v);
  if (Math.abs(den) < 1e-8) return;
  const m11 = (a.x * (b.v - c.v) + b.x * (c.v - a.v) + c.x * (a.v - b.v)) / den;
  const m21 = (a.x * (c.u - b.u) + b.x * (a.u - c.u) + c.x * (b.u - a.u)) / den;
  const dx = (a.x * (b.u * c.v - c.u * b.v) + b.x * (c.u * a.v - a.u * c.v) + c.x * (a.u * b.v - b.u * a.v)) / den;
  const m12 = (a.y * (b.v - c.v) + b.y * (c.v - a.v) + c.y * (a.v - b.v)) / den;
  const m22 = (a.y * (c.u - b.u) + b.y * (a.u - c.u) + c.y * (b.u - a.u)) / den;
  const dy = (a.y * (b.u * c.v - c.u * b.v) + b.y * (c.u * a.v - a.u * c.v) + c.y * (a.u * b.v - b.u * a.v)) / den;
  // Expand triangle clips by a fraction of an output pixel to eliminate mesh hairlines.
  const center = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
  const edgeDistance = (p: Point, q: Point) => Math.abs((q.x - p.x) * (p.y - center.y) - (p.x - center.x) * (q.y - p.y)) / Math.max(1e-8, Math.hypot(q.x - p.x, q.y - p.y));
  const inradius = Math.min(edgeDistance(a, b), edgeDistance(b, c), edgeDistance(c, a));
  const k = 1 + seam / Math.max(1e-6, inradius);
  const expand = (p: Point) => ({ x: center.x + (p.x - center.x) * k, y: center.y + (p.y - center.y) * k });
  const aa = expand(a), bb = expand(b), cc = expand(c);
  ctx.save(); ctx.beginPath(); ctx.moveTo(aa.x, aa.y); ctx.lineTo(bb.x, bb.y); ctx.lineTo(cc.x, cc.y); ctx.closePath(); ctx.clip();
  ctx.transform(m11, m12, m21, m22, dx, dy);
  ctx.drawImage(source, 0, 0);
  ctx.restore();
}
