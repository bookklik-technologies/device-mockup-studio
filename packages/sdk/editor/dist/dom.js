import { icon, setButtonContent } from './icons.js';
import { colorControl } from './color-picker.js';
/** Small DOM helpers: user-supplied strings are always text, never HTML. */
export function element(doc, tag, className = '', text) {
    const node = doc.createElement(tag);
    if (className)
        node.className = className;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
export function button(doc, label, action, className = '') {
    const node = element(doc, 'button', className);
    setButtonContent(node, label);
    node.type = 'button';
    node.setAttribute('aria-label', label);
    node.title = label;
    node.onclick = action;
    return node;
}
export function field(doc, parent, label, input) {
    const isColor = input.classList.contains('ms-color');
    const row = element(doc, isColor ? 'div' : 'label', 'ms-field');
    const caption = element(doc, isColor ? 'label' : 'span', isColor ? 'ms-field-label' : '', label);
    if (isColor) {
        input.id = `ms-color-field-${++fieldSequence}`;
        caption.htmlFor = input.id;
    }
    row.append(caption);
    parent.append(row);
    input.setAttribute('aria-label', label);
    row.append(isColor ? colorControl(doc, input) : input);
}
export function select(doc, choices, value, change) {
    const node = element(doc, 'select');
    for (const choice of choices) {
        const option = element(doc, 'option', '', typeof choice === 'string' ? choice : choice.label);
        option.value = typeof choice === 'string' ? choice : choice.value;
        node.append(option);
    }
    node.value = value;
    node.onchange = () => change(node.value);
    return node;
}
export function text(doc, value, change, multiline = false) {
    const node = multiline ? element(doc, 'textarea') : element(doc, 'input');
    node.value = value;
    node.onchange = () => change(node.value);
    return node;
}
export function number(doc, value, change, min, max, step = 1) {
    const node = element(doc, 'input');
    node.type = 'number';
    node.value = String(Math.round(value * 1000) / 1000);
    node.dataset.preciseValue = String(value);
    node.min = String(min);
    node.max = String(max);
    node.step = String(step);
    node.onchange = () => { const n = node.valueAsNumber; if (Number.isFinite(n))
        change(Math.min(max, Math.max(min, n))); };
    return node;
}
export function color(doc, value, change) {
    // Text fields retain alpha CSS colors and gradients' original color formats.
    const node = text(doc, value, change);
    node.className = 'ms-color';
    return node;
}
export function check(doc, value, change) {
    const node = element(doc, 'input');
    node.type = 'checkbox';
    node.checked = value;
    node.onchange = () => change(node.checked);
    return node;
}
export function section(doc, parent, title) {
    const node = element(doc, 'section', 'ms-section');
    node.append(element(doc, 'h3', '', title));
    parent.append(node);
    return node;
}
export function disclosure(doc, parent, title, open = false) {
    const node = element(doc, 'details', 'ms-section ms-disclosure');
    node.open = open;
    node.dataset.section = title;
    const summary = element(doc, 'summary', '', title);
    summary.setAttribute('aria-label', title);
    summary.append(icon(doc, 'ChevronDown'));
    const content = element(doc, 'div', 'ms-disclosure-content');
    node.append(summary, content);
    parent.append(node);
    return content;
}
let fieldSequence = 0;
const layerErrors = new WeakMap();
/** Layer-only editing semantics; canvas controls retain their existing behavior. */
export function enhanceLayerFields(parent) {
    const doc = parent.ownerDocument;
    const context = parent.dataset.context ?? '';
    let state = layerErrors.get(parent);
    if (!state || state.context !== context) {
        state = { context, messages: new Map() };
        layerErrors.set(parent, state);
    }
    for (const input of parent.querySelectorAll('.ms-field input:not([type=checkbox]),.ms-field textarea')) {
        const row = input.closest('.ms-field');
        if (input.type === 'number')
            input.value = String(Number(Number(input.dataset.preciseValue).toPrecision(12)));
        let committed = input.value;
        const original = input.onchange;
        const key = input.getAttribute('aria-label');
        const error = element(doc, 'span', 'ms-field-error');
        error.id = `ms-field-error-${++fieldSequence}`;
        error.hidden = true;
        error.setAttribute('role', 'status');
        row.append(error);
        const clearError = () => { state.messages.delete(key); input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); error.hidden = true; };
        const showError = (message) => { state.messages.set(key, message); input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', error.id); error.textContent = message; error.hidden = false; };
        const saved = state.messages.get(key);
        if (saved)
            showError(saved);
        input.oninput = clearError;
        input.onchange = event => {
            const value = input.value;
            if (value === committed)
                return;
            let message = '';
            if (input instanceof (doc.defaultView.HTMLInputElement) && input.type === 'number') {
                const n = input.valueAsNumber;
                if (!value.trim() || !Number.isFinite(n))
                    message = 'Enter a number.';
                else if (n < Number(input.min) || n > Number(input.max))
                    message = `Enter a value from ${input.min} to ${input.max}.`;
            }
            else if (input.classList.contains('ms-color') && (!value.trim() || !doc.defaultView.CSS.supports('color', value) || /^(inherit|initial|unset|revert|currentcolor)$/i.test(value.trim()) || /var\(/i.test(value))) {
                message = 'Enter a CSS color, such as #336699, rgba(0,0,0,0.5), or transparent.';
            }
            if (message) {
                input.value = committed;
                showError(message);
                return;
            }
            clearError();
            committed = value;
            original?.call(input, event);
        };
        // Native number inputs do not consistently emit change when cleared.
        input.onblur = () => input.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
        input.onkeydown = event => {
            if (event.key === 'Escape' && (input.value !== committed || input.hasAttribute('aria-invalid'))) {
                event.preventDefault();
                event.stopPropagation();
                input.value = committed;
                clearError();
            }
            else if (event.key === 'Enter' && input.tagName !== 'TEXTAREA' && !event.isComposing) {
                event.preventDefault();
                input.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
            }
        };
    }
    for (const select of parent.querySelectorAll('select')) {
        const original = select.onchange;
        const caption = element(doc, 'span', 'ms-selected-value');
        const describe = () => { const value = select.selectedOptions[0]?.textContent ?? ''; select.title = value; caption.textContent = value; caption.hidden = value.length <= 40; };
        select.closest('.ms-field')?.append(caption);
        describe();
        select.onchange = event => { describe(); original?.call(select, event); };
    }
}
//# sourceMappingURL=dom.js.map