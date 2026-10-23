import { icon } from './icons.js';

type RGBA = [number, number, number, number];
let pickerSequence = 0;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
function readColor(doc: Document, value: string): RGBA {
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value.trim())?.[1];
  if (hex) {
    const full = hex.length < 5 ? [...hex].map(c => c + c).join('') : hex;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16), full.length === 8 ? parseInt(full.slice(6), 16) / 255 : 1];
  }
  // Resolve named and other browser-supported CSS colors to the picker's sRGB space.
  const canvas = doc.createElement('canvas'); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1);
  const bytes = ctx.getImageData(0, 0, 1, 1).data;
  return [bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]! / 255];
}
function hsv([red, green, blue]: RGBA): [number, number, number] {
  const r = red / 255, g = green / 255, b = blue / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const hue = delta === 0 ? 0 : max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return [hue * 60, max === 0 ? 0 : delta / max, max];
}
function rgb(hue: number, saturation: number, value: number): [number, number, number] {
  const f = (n: number) => { const k = (n + hue / 60) % 6; return Math.round(255 * (value - value * saturation * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return [f(5), f(3), f(1)];
}
function hexColor(channels: number[], alpha: number): string {
  return '#' + [...channels, ...(alpha < 1 ? [Math.round(alpha * 255)] : [])].map(n => n.toString(16).padStart(2, '0')).join('');
}
function node<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const result = doc.createElement(tag); result.className = className; if (text) result.textContent = text; return result;
}

/** A reusable visual picker; the existing CSS text field stays the source of committed edits. */
export function colorControl(doc: Document, input: HTMLInputElement): HTMLElement {
  const control = node(doc, 'span', 'ms-color-control');
  const trigger = node(doc, 'button', 'ms-color-trigger'); trigger.type = 'button';
  const name = `Choose ${input.getAttribute('aria-label')!.toLowerCase()}`;
  trigger.setAttribute('aria-label', name); trigger.title = 'Choose color'; trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-expanded', 'false');
  const swatch = node(doc, 'span', 'ms-color-swatch'); swatch.setAttribute('aria-hidden', 'true');
  const fill = node(doc, 'span'); fill.style.backgroundColor = input.value; swatch.append(fill); trigger.append(swatch);
  control.append(trigger, input);
  trigger.onclick = () => {
    if (input.disabled || trigger.disabled) return;
    const root = input.closest<HTMLElement>('.ms-editor')!;
    const dialog = node(doc, 'dialog', 'ms-color-dialog'); dialog.id = `ms-color-picker-${++pickerSequence}`; dialog.setAttribute('aria-label', name); trigger.setAttribute('aria-controls', dialog.id);
    const initial = readColor(doc, input.value);
    let [hue, saturation, value] = hsv(initial), alpha = initial[3];
    const initialHex = hexColor(rgb(hue, saturation, value), alpha);
    let displayedHex = '', displayedOpacity = '';
    let closing = false;
    let motion: Animation | undefined;
    const animate = (frames: Keyframe[], complete?: () => void) => {
      motion?.cancel(); motion = undefined;
      if (doc.defaultView!.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof dialog.animate !== 'function') { complete?.(); return; }
      const current = dialog.animate(frames, { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }); motion = current;
      void current.finished.then(() => { if (motion === current) { motion = undefined; complete?.(); } }).catch(() => { /* Closing can replace an in-flight entrance. */ });
    };
    const original = input.value;
    const heading = node(doc, 'div', 'ms-color-heading');
    heading.append(node(doc, 'h2', '', input.getAttribute('aria-label')!));
    const closeButton = node(doc, 'button'); closeButton.type = 'button'; closeButton.setAttribute('aria-label', 'Cancel color picker'); closeButton.append(icon(doc, 'X')); heading.append(closeButton);
    const square = node(doc, 'div', 'ms-color-square'); square.tabIndex = 0; square.setAttribute('role', 'slider'); square.setAttribute('aria-label', 'Saturation and brightness'); square.setAttribute('aria-valuemin', '0'); square.setAttribute('aria-valuemax', '100');
    const marker = node(doc, 'span', 'ms-color-marker'); marker.setAttribute('aria-hidden', 'true'); square.append(marker);
    const hint = node(doc, 'p', 'ms-hint', 'Drag to choose a color. Arrow keys adjust saturation and brightness.');
    hint.id = `${dialog.id}-hint`; square.setAttribute('aria-describedby', hint.id);
    const hueInput = node(doc, 'input'); hueInput.type = 'range'; hueInput.min = '0'; hueInput.max = '360'; hueInput.step = '1'; hueInput.setAttribute('aria-label', 'Hue'); hueInput.className = 'ms-color-hue';
    const alphaInput = node(doc, 'input'); alphaInput.type = 'range'; alphaInput.min = '0'; alphaInput.max = '100'; alphaInput.step = '1'; alphaInput.setAttribute('aria-label', 'Color opacity'); alphaInput.className = 'ms-color-alpha';
    const hueLabel = node(doc, 'label', 'ms-color-slider-label', 'Hue'); hueLabel.append(hueInput);
    const alphaLabel = node(doc, 'label', 'ms-color-slider-label', 'Opacity'); alphaLabel.append(alphaInput);
    const fields = node(doc, 'div', 'ms-color-values');
    const hex = node(doc, 'input'); hex.type = 'text'; hex.setAttribute('aria-label', 'Hex color'); hex.spellcheck = false;
    const opacity = node(doc, 'input'); opacity.type = 'number'; opacity.min = '0'; opacity.max = '100'; opacity.step = '1'; opacity.setAttribute('aria-label', 'Color opacity percent');
    const hexLabel = node(doc, 'label', 'ms-field ms-color-hex'); hexLabel.append(node(doc, 'span', '', 'Hex'), hex);
    const opacityLabel = node(doc, 'label', 'ms-field'); opacityLabel.append(node(doc, 'span', '', 'Opacity %'), opacity); fields.append(hexLabel, opacityLabel);
    const error = node(doc, 'p', 'ms-field-error'); error.id = `${dialog.id}-error`; error.setAttribute('role', 'status'); error.hidden = true;
    hex.setAttribute('aria-describedby', error.id); opacity.setAttribute('aria-describedby', error.id);
    const preview = node(doc, 'div', 'ms-color-preview');
    const previous = node(doc, 'button', 'ms-color-previous'); previous.type = 'button'; previous.setAttribute('aria-label', 'Restore original color'); previous.title = 'Restore original color';
    const previousFill = node(doc, 'span'); previousFill.style.backgroundColor = original; previous.append(previousFill);
    const next = node(doc, 'span', 'ms-color-next'); next.title = 'New color'; next.setAttribute('aria-label', 'New color preview'); const nextFill = node(doc, 'span'); next.append(nextFill); preview.append(previous, next);
    const palette = node(doc, 'div', 'ms-color-palette'); palette.setAttribute('role', 'group'); palette.setAttribute('aria-label', 'Color presets');
    const actions = node(doc, 'div', 'ms-actions');
    const cancel = node(doc, 'button', '', 'Cancel'); cancel.type = 'button';
    const apply = node(doc, 'button', 'ms-primary', 'Apply color'); apply.type = 'button'; actions.append(cancel, apply);
    const clearError = () => { error.hidden = true; hex.removeAttribute('aria-invalid'); opacity.removeAttribute('aria-invalid'); };
    const update = () => {
      const channels = rgb(hue, saturation, value), current = hexColor(channels, alpha);
      square.style.backgroundColor = `hsl(${hue} 100% 50%)`; marker.style.left = `${saturation * 100}%`; marker.style.top = `${(1 - value) * 100}%`;
      square.setAttribute('aria-valuenow', String(Math.round(saturation * 100))); square.setAttribute('aria-valuetext', `Saturation ${Math.round(saturation * 100)}%, brightness ${Math.round(value * 100)}%`);
      hueInput.value = String(hue); alphaInput.value = String(alpha * 100); opacity.value = displayedOpacity = String(Math.round(alpha * 100)); hex.value = displayedHex = current;
      alphaInput.style.setProperty('--ms-picked-rgb', channels.join(',')); nextFill.style.backgroundColor = current;
    };
    const setColor = (color: string) => { const rgba = readColor(doc, color); [hue, saturation, value] = hsv(rgba); alpha = rgba[3]; clearError(); update(); };
    const finish = (color?: string) => {
      if (closing) return;
      closing = true;
      const current = doc.defaultView!.getComputedStyle(dialog);
      const from = { opacity: current.opacity, transform: current.transform };
      dialog.classList.add('ms-dialog-closing');
      animate([from, { opacity: 0, transform: 'translateY(8px) scale(.98)' }], () => {
        dialog.close(); dialog.remove(); trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-controls');
        if (color !== undefined && input.isConnected && !input.disabled) { input.value = color; input.dispatchEvent(new doc.defaultView!.Event('change', { bubbles: true })); }
        const replacement = Array.from(root.querySelectorAll<HTMLButtonElement>('.ms-color-trigger')).find(button => button.getAttribute('aria-label') === name && !button.disabled);
        (replacement ?? root).focus({ preventScroll: true });
      });
    };
    closeButton.onclick = cancel.onclick = () => finish(); previous.onclick = () => setColor(original);
    dialog.oncancel = event => { event.preventDefault(); finish(); };
    dialog.onclick = event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) finish(); } };
    hueInput.oninput = () => { hue = hueInput.valueAsNumber; clearError(); update(); };
    alphaInput.oninput = () => { alpha = alphaInput.valueAsNumber / 100; clearError(); update(); };
    const readHex = () => {
      if (!/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(hex.value.trim())) { error.textContent = 'Enter a hex color, such as #336699 or #33669980.'; error.hidden = false; hex.setAttribute('aria-invalid', 'true'); return false; }
      setColor(hex.value.trim()); return true;
    };
    const readOpacity = () => {
      if (!opacity.value.trim() || !Number.isFinite(opacity.valueAsNumber) || opacity.valueAsNumber < 0 || opacity.valueAsNumber > 100) { error.textContent = 'Opacity must be from 0 to 100%.'; error.hidden = false; opacity.setAttribute('aria-invalid', 'true'); return false; }
      alpha = opacity.valueAsNumber / 100; clearError(); update(); return true;
    };
    hex.onchange = () => readHex(); opacity.onchange = () => readOpacity();
    hex.onblur = () => { if (hex.value !== displayedHex) readHex(); };
    opacity.onblur = () => { if (opacity.value !== displayedOpacity) readOpacity(); };
    apply.onclick = () => {
      if (!input.isConnected || input.disabled) { error.textContent = 'The selected layer changed. Close this picker and open it again.'; error.hidden = false; return; }
      if (hex.hasAttribute('aria-invalid') || opacity.hasAttribute('aria-invalid')) return;
      const colorValue = hex.value.trim(), opacityValue = opacity.value;
      if (!/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(colorValue)) { readHex(); return; }
      if (!opacityValue.trim() || !Number.isFinite(opacity.valueAsNumber) || opacity.valueAsNumber < 0 || opacity.valueAsNumber > 100) { readOpacity(); return; }
      const opacityEdited = opacityValue !== displayedOpacity;
      if (colorValue !== displayedHex) setColor(colorValue);
      if (opacityEdited) alpha = Number(opacityValue) / 100;
      const chosen = hexColor(rgb(hue, saturation, value), alpha);
      finish(chosen === initialHex ? undefined : chosen);
    };
    const point = (event: PointerEvent) => { const rect = square.getBoundingClientRect(); saturation = clamp((event.clientX - rect.left) / rect.width); value = 1 - clamp((event.clientY - rect.top) / rect.height); clearError(); update(); };
    square.onpointerdown = event => { if (event.button !== 0) return; square.focus(); square.setPointerCapture(event.pointerId); point(event); };
    square.onpointermove = event => { if (square.hasPointerCapture(event.pointerId)) point(event); };
    square.onpointerup = event => { if (square.hasPointerCapture(event.pointerId)) { point(event); square.releasePointerCapture(event.pointerId); } };
    square.onkeydown = event => {
      const step = event.shiftKey ? .1 : .01;
      if (event.key === 'ArrowLeft') saturation = clamp(saturation - step);
      else if (event.key === 'ArrowRight') saturation = clamp(saturation + step);
      else if (event.key === 'ArrowUp') value = clamp(value + step);
      else if (event.key === 'ArrowDown') value = clamp(value - step);
      else return;
      event.preventDefault(); clearError(); update();
    };
    dialog.onkeydown = event => {
      event.stopPropagation();
      if (closing) { event.preventDefault(); return; }
      if (event.key === 'Escape') { event.preventDefault(); finish(); }
      else if (event.key === 'Enter' && event.target === hex) { event.preventDefault(); readHex(); }
      else if (event.key === 'Enter' && event.target === opacity) { event.preventDefault(); readOpacity(); }
      else if (event.key === 'Tab') {
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button,input,[tabindex="0"]')).filter(control => control.getClientRects().length);
        const index = controls.indexOf(doc.activeElement as HTMLElement), next = controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length];
        if (next) { event.preventDefault(); next.focus(); }
      }
    };
    for (const color of ['#ffffff', '#1b1b1b', '#ff5555', '#ffcc33', '#48c78e', '#36a3ff', '#a678f2', 'transparent']) {
      const choice = node(doc, 'button', 'ms-color-preset'); choice.type = 'button'; choice.setAttribute('aria-label', `Use ${color}`); choice.title = color;
      const tile = node(doc, 'span'); tile.style.backgroundColor = color; choice.append(tile); choice.onclick = () => setColor(color); palette.append(choice);
    }
    dialog.append(heading, square, hint, hueLabel, alphaLabel, preview, fields, error, palette, actions);
    root.append(dialog); update(); trigger.setAttribute('aria-expanded', 'true'); dialog.showModal(); square.focus();
    animate([{ opacity: 0, transform: 'translateY(12px) scale(.97)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }]);
  };
  return control;
}
