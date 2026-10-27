/** The pinned gifenc release does not ship TypeScript declarations. */
declare module 'gifenc' {
  export function quantize(data: Uint8ClampedArray, colors: number): number[][];
  export function applyPalette(data: Uint8ClampedArray, palette: number[][]): Uint8Array;
  export function GIFEncoder(options?: { auto?: boolean }): {
    writeHeader(): void;
    writeFrame(indices: Uint8Array, width: number, height: number, options: {
      first: boolean; palette: number[][]; delay: number; repeat: number;
      transparent: boolean; transparentIndex: number; dispose: number;
    }): void;
    finish(): void;
    bytesView(): Uint8Array;
    reset(): void;
  };
  /** CommonJS interop: Node exposes the whole named-export record as the default. */
  const gifencExports: {
    quantize: typeof quantize;
    applyPalette: typeof applyPalette;
    GIFEncoder: typeof GIFEncoder;
  };
  export default gifencExports;
}
