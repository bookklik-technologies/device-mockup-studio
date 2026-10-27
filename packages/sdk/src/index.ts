/** Browser SDK facade. Import @mockup-studio/core alone for DOM-free scene/state use. */
export * from '@mockup-studio/core';
export * from '@mockup-studio/presets';
export * from '@mockup-studio/render';
export * from '@mockup-studio/media';
export * from '@mockup-studio/editor';
export * from '@mockup-studio/spatial';
export { createHeadlessStudio } from './headless.js';
export type { HeadlessStudio, HeadlessStudioOptions } from './headless.js';
