import { ArrowDown, ArrowUp, Box, ChevronDown, CircleHelp, Copy, Download, Eye, EyeOff, Film, FolderOpen, ImagePlus, Layers, LayoutTemplate, Lock, Menu, Monitor, Moon, MousePointer2, PanelLeft, PanelsTopLeft, Pause, Play, Redo2, Save, Shapes, Smartphone, Sparkles, Stamp, Sun, Trash2, Type, Undo2, Unlock, Upload, X } from 'lucide';
import { AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Magnet } from 'lucide';
const icons = { AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Magnet, ArrowDown, ArrowUp, Box, ChevronDown, CircleHelp, Copy, Download, Eye, EyeOff, Film, FolderOpen, ImagePlus, Layers, LayoutTemplate, Lock, Menu, Monitor, Moon, MousePointer2, PanelLeft, PanelsTopLeft, Pause, Play, Redo2, Save, Shapes, Smartphone, Sparkles, Stamp, Sun, Trash2, Type, Undo2, Unlock, Upload, X };
/** Render official Lucide nodes in the editor's document, including iframe hosts. */
export function icon(doc, name) {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const attributes = { viewBox: '0 0 24 24', width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false', class: 'ms-icon' };
    for (const [key, value] of Object.entries(attributes))
        svg.setAttribute(key, value);
    for (const [tag, attrs] of icons[name]) {
        const child = doc.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [key, value] of Object.entries(attrs))
            if (value !== undefined)
                child.setAttribute(key, String(value));
        svg.append(child);
    }
    return svg;
}
const actionIcons = {
    Undo: 'Undo2', Redo: 'Redo2', 'Upload media': 'Upload', 'Replace screenshot': 'ImagePlus',
    'Save project': 'Save', 'Open project': 'FolderOpen', 'Export PNG': 'Download', 'Export video': 'Film', 'Export GIF': 'Film',
    'Cancel export': 'X', Mockup: 'PanelsTopLeft', Text: 'Type', Shape: 'Shapes', '3D object': 'Box', Watermark: 'Stamp',
    Library: 'PanelLeft', 'Close library': 'X', 'Quick start': 'CircleHelp', 'Hide guide': 'X',
    Layers: 'Layers', Presets: 'LayoutTemplate', Devices: 'Monitor', Media: 'ImagePlus',
    'Selected layer': 'MousePointer2', Canvas: 'PanelsTopLeft', Duplicate: 'Copy', Remove: 'Trash2',
    'Send back': 'ArrowDown', 'Bring forward': 'ArrowUp', 'Apply motion': 'Sparkles',
    'Play preview': 'Play', 'Pause preview': 'Pause',
};
export function setButtonContent(node, label, name = actionIcons[label], iconOnly = false) {
    node.replaceChildren();
    if (name)
        node.append(icon(node.ownerDocument, name));
    const text = node.ownerDocument.createElement('span');
    text.textContent = label;
    if (iconOnly) {
        text.className = 'ms-sr-only';
        node.classList.add('ms-icon-only');
    }
    node.append(text);
    node.setAttribute('aria-label', label);
    node.title = label;
}
//# sourceMappingURL=icons.js.map