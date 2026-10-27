export const styles = `
.ms-editor { --ms-bg:#1b1b1b; --ms-panel:#242424; --ms-input:#303030; --ms-line:#555555; --ms-text:#f2f2f2; --ms-muted:#b8b8b8; --ms-accent:#00ffff; --ms-mark-text:#00ffff; --ms-primary-bg:#00ffff; --ms-primary-text:#404040; --ms-primary-line:#007777; --ms-primary-hover:#00e6e6; --ms-canvas-shadow:#0005; --ms-error:#ffb4b2; --ms-notice-bg:#542c32; --ms-notice-text:#ffe6e5; --ms-notice-line:#a15a65; color-scheme:dark; font:13px/1.5 'Outfit',sans-serif; color:var(--ms-text); background:var(--ms-bg); display:flex; flex-direction:column; width:100%; height:100%; min-height:580px; overflow:hidden; position:relative; isolation:isolate; text-align:left; }
.ms-editor.ms-light { --ms-bg:#f3f4f4; --ms-panel:#ffffff; --ms-input:#f1f3f3; --ms-line:#c7cece; --ms-text:#404040; --ms-muted:#626969; --ms-accent:#007777; --ms-mark-text:#404040; --ms-canvas-shadow:#00000029; --ms-error:#a32238; --ms-notice-bg:#fff0f2; --ms-notice-text:#792337; --ms-notice-line:#e5a1ac; --ms-primary-bg:#007777; --ms-primary-text:#ffffff; --ms-primary-line:#005f5f; --ms-primary-hover:#008c8c; color-scheme:light; }
.ms-editor *, .ms-editor *::before, .ms-editor *::after { box-sizing:border-box; }
.ms-editor [hidden] { display:none!important; }
.ms-editor button,.ms-editor input,.ms-editor select,.ms-editor textarea { font:inherit; color:inherit; }
.ms-editor button { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:36px; border:1px solid transparent; border-radius:4px; padding:7px 10px; background:transparent; cursor:pointer; white-space:nowrap; }
.ms-editor button:hover:not(:disabled) { background:color-mix(in srgb,var(--ms-text) 6%,transparent); }
.ms-editor button:disabled { opacity:.4; cursor:not-allowed; }
.ms-editor :is(button,input,select,textarea,summary,canvas):focus-visible { outline:2px solid var(--ms-accent); outline-offset:3px; }
.ms-editor .ms-icon { width:17px; height:17px; flex:none; vertical-align:middle; }
.ms-editor .ms-icon-only { width:36px; padding:7px; }
.ms-editor .ms-primary { color-scheme:only light; color:var(--ms-primary-text); background:var(--ms-primary-bg); border-color:var(--ms-primary-line); font-weight:500; }
.ms-editor .ms-primary>span { position:relative; color:var(--ms-primary-text); -webkit-text-fill-color:var(--ms-primary-text); }
.ms-editor .ms-primary:hover:not(:disabled) { background:var(--ms-primary-hover); border-color:var(--ms-primary-line); }
.ms-editor .ms-quiet { border-color:transparent; background:transparent; }
.ms-editor .ms-tabs button { border:0; border-bottom:2px solid transparent; border-radius:0; }
.ms-editor .ms-tabs .ms-selected { color:var(--ms-accent); border-bottom-color:var(--ms-accent); background:transparent; }
.ms-editor .ms-tabs button:hover:not(:disabled) { color:var(--ms-accent); background:transparent; }
.ms-editor .ms-header { display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--ms-line); padding:8px 12px; min-height:56px; background:var(--ms-panel); flex-wrap:wrap; }
.ms-editor .ms-history { display:flex; align-items:center; gap:2px; flex:none; }
.ms-editor .ms-brand { display:flex; align-items:center; gap:9px; font-size:17px; font-weight:600; letter-spacing:-.5px; margin-right:6px; }
.ms-editor .ms-mark { color:var(--ms-mark-text); width:30px; height:30px; flex:none; display:grid; place-items:center; }
.ms-editor .ms-mark>svg { display:block; width:100%; height:100%; }
.ms-editor .ms-spacer { flex:1; }
.ms-editor .ms-toolbar { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.ms-editor .ms-actions-dialog { width:min(420px,calc(100% - 32px)); max-height:calc(100dvh - 32px); margin:auto; padding:20px; border:1px solid var(--ms-line); border-radius:8px; background:var(--ms-panel); color:var(--ms-text); box-shadow:0 20px 80px #0005; overflow:auto; overscroll-behavior:contain; }
.ms-editor .ms-actions-dialog::backdrop { background:#0008; }
.ms-editor .ms-actions-dialog[open]::backdrop,.ms-editor .ms-color-dialog[open]::backdrop { animation:ms-backdrop-enter 220ms ease-out both; }
.ms-editor .ms-actions-dialog.ms-dialog-closing::backdrop,.ms-editor .ms-color-dialog.ms-dialog-closing::backdrop { animation:ms-backdrop-exit 220ms ease-in both; }
@keyframes ms-backdrop-enter { from { opacity:0; } to { opacity:1; } }
@keyframes ms-backdrop-exit { from { opacity:1; } to { opacity:0; } }
.ms-editor .ms-dialog-header { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.ms-editor .ms-dialog-header h2 { font-size:18px; font-weight:600; margin:0; letter-spacing:-.3px; }
.ms-editor .ms-dialog-header button { min-width:40px; min-height:40px; }
.ms-editor .ms-dialog-intro { color:var(--ms-muted); margin:6px 0 16px; }
.ms-editor .ms-dialog-section { padding:12px 0; }
.ms-editor .ms-dialog-section+.ms-dialog-section { border-top:1px solid var(--ms-line); }
.ms-editor .ms-dialog-section:last-child { padding-bottom:0; }
.ms-editor .ms-dialog-section h3 { margin-bottom:6px; }
.ms-editor .ms-dialog-section button { width:100%; min-height:44px; justify-content:flex-start; gap:10px; }
.ms-editor .ms-guide { display:flex; gap:22px; align-items:center; padding:14px 18px; border-bottom:1px solid var(--ms-line); background:var(--ms-panel); }
.ms-editor .ms-guide-intro { display:flex; flex-direction:column; gap:3px; flex:none; }
.ms-editor .ms-guide-intro strong { font-size:15px; font-weight:500; }
.ms-editor .ms-guide-intro>span { color:var(--ms-muted); font-size:12px; }
.ms-editor .ms-steps { display:flex; flex:1; list-style:none; padding:0; margin:0; gap:12px; }
.ms-editor .ms-steps li { flex:1; min-width:0; }
.ms-editor .ms-guide-step { background:transparent; border:0; text-align:left; justify-content:flex-start; width:100%; padding:5px; white-space:normal; }
.ms-editor .ms-guide-step:hover:not(:disabled) { background:transparent; }
.ms-editor .ms-guide-step:hover:not(:disabled) strong { color:var(--ms-accent); text-decoration:underline; text-underline-offset:3px; }
.ms-editor .ms-step-number { color:var(--ms-accent); font-variant-numeric:tabular-nums; font-weight:500; width:29px; height:29px; display:grid; place-items:center; flex:none; }
.ms-editor .ms-guide-step strong,.ms-editor .ms-guide-step small { display:block; }
.ms-editor .ms-guide-step strong { font-size:13px; font-weight:500; }
.ms-editor .ms-guide-step small { color:var(--ms-muted); font-size:12px; }
.ms-editor .ms-workspace { display:grid; grid-template-columns:min(40vw,40%,var(--ms-library-width,var(--ms-library-default-width,238px))) minmax(180px,1fr) 294px; min-height:0; flex:1; position:relative; overflow:hidden; transition:grid-template-columns 220ms cubic-bezier(.2,.8,.2,1); }
.ms-editor.ms-inspector-hidden .ms-workspace { grid-template-columns:min(40vw,40%,var(--ms-library-width,var(--ms-library-default-width,238px))) minmax(180px,1fr) 0px; }
.ms-editor .ms-left,.ms-editor .ms-right { background:var(--ms-panel); overflow:auto; scrollbar-width:thin; scrollbar-color:var(--ms-line) transparent; min-height:0; }
.ms-editor .ms-left { position:relative; min-width:0; border-right:1px solid var(--ms-line); display:flex; flex-direction:column; overflow:hidden; }
.ms-editor .ms-right { min-width:0; border-left:1px solid var(--ms-line); }
.ms-editor .ms-library-heading { display:none; align-items:center; justify-content:flex-end; padding:14px 14px 0; }
.ms-editor .ms-library-heading button { display:none; }
.ms-editor .ms-tabs { display:flex; gap:3px; padding:12px 10px; position:sticky; top:0; z-index:2; background:var(--ms-panel); }
.ms-editor .ms-tabs button { flex:1; font-size:12px; padding:6px; }
.ms-editor .ms-tabs .ms-icon { width:15px; height:15px; }
.ms-editor .ms-library-tabs { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); flex:none; gap:0; padding:10px 8px; }
.ms-editor .ms-library-tabs button { flex-direction:column; gap:4px; min-width:0; min-height:54px; padding:7px 2px; font-size:11px; }
.ms-editor .ms-library-panel { padding:0 12px 16px; flex:1; min-height:0; overflow:auto; scrollbar-width:thin; scrollbar-color:var(--ms-line) transparent; }
.ms-editor .ms-library-panel:focus-visible { outline:2px solid var(--ms-accent); outline-offset:-2px; }
.ms-editor .ms-library-resizer { position:absolute; top:0; right:0; bottom:0; width:8px; cursor:col-resize; touch-action:none; z-index:3; }
.ms-editor .ms-library-resizer:hover,.ms-editor .ms-library-resizer:focus-visible,.ms-editor.ms-resizing-library .ms-library-resizer { background:var(--ms-accent); }
.ms-editor .ms-library-resizer:focus-visible { outline:2px solid var(--ms-accent); outline-offset:-2px; }
.ms-editor.ms-resizing-library,.ms-editor.ms-resizing-library * { cursor:col-resize!important; user-select:none; }
.ms-editor.ms-resizing-library .ms-workspace { transition:none; }
.ms-editor .ms-hint { color:var(--ms-muted); margin:5px 0 12px; font-size:12px; line-height:1.6; }
.ms-editor .ms-preset-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
.ms-editor .ms-preset { display:block; min-width:0; border:0; border-radius:0; padding:0; text-align:left; white-space:normal; background:transparent; }
.ms-editor .ms-preset:hover:not(:disabled) { background:transparent; color:var(--ms-accent); }
.ms-editor .ms-preset:hover:not(:disabled) .ms-preset-name { text-decoration:underline; text-underline-offset:3px; }
.ms-editor .ms-preset-art { aspect-ratio:4/3; border-radius:4px; overflow:hidden; display:grid; place-items:center; }
.ms-editor .ms-preset-art img { display:block; width:100%; height:100%; object-fit:contain; opacity:0; }
.ms-editor .ms-preview-ready img { opacity:1; }
.ms-editor .ms-preview-error { font-size:11px; color:var(--ms-muted); }
.ms-editor .ms-preset-name { display:block; padding:8px 0; font-size:12px; }
.ms-editor .ms-font-sample { margin:0 0 14px; font-size:18px; line-height:1.5; overflow-wrap:anywhere; }
.ms-editor .ms-device { justify-content:flex-start; width:100%; margin-bottom:7px; white-space:normal; text-align:left; }
.ms-editor .ms-media { justify-content:flex-start; width:100%; margin-top:8px; text-align:left; }
.ms-editor .ms-media img { width:42px; height:34px; object-fit:contain; background:var(--ms-input); border:1px solid var(--ms-line); border-radius:4px; flex:none; }
.ms-editor .ms-media span { overflow:hidden; text-overflow:ellipsis; }
.ms-editor h3 { font-size:12px; letter-spacing:.2px; color:var(--ms-muted); margin:0 0 12px; font-weight:500; }
.ms-editor .ms-layer-title { display:flex; align-items:center; gap:8px; }
.ms-editor .ms-layer { display:flex; gap:4px; align-items:center; margin:5px 0; border-left:2px solid transparent; }
.ms-editor .ms-layer:hover { background:color-mix(in srgb,var(--ms-text) 4%,transparent); }
.ms-editor .ms-layer-selected,.ms-editor .ms-layer-selected:hover { border-left-color:var(--ms-accent); background:color-mix(in srgb,var(--ms-accent) 10%,var(--ms-panel)); }
.ms-editor .ms-layer button { border:0; border-radius:0; }
.ms-editor .ms-layer button:hover:not(:disabled) { background:transparent; color:var(--ms-accent); }
.ms-editor .ms-layer button:focus-visible { outline-offset:-2px; }
.ms-editor .ms-layer-name { min-width:0; text-align:left; justify-content:flex-start; flex:1; padding:7px; }
.ms-editor .ms-layer-name>span { min-width:0; overflow:hidden; text-overflow:ellipsis; }
.ms-editor .ms-mini { min-width:32px; width:32px; min-height:36px; padding:6px; }
.ms-editor .ms-mini .ms-icon { width:15px; height:15px; }
.ms-editor .ms-stage { display:flex; flex-direction:column; min-width:0; min-height:0; }
.ms-editor .ms-stage-bar { display:flex; align-items:center; gap:5px; padding:9px 12px; min-height:52px; color:var(--ms-muted); flex-wrap:wrap; }
.ms-editor .ms-dimensions { white-space:nowrap; font-size:12px; }
.ms-editor .ms-stage-bar button { padding:6px 8px; font-size:12px; }
.ms-editor .ms-stage-bar button[aria-pressed="true"] { color:var(--ms-accent); }
.ms-editor .ms-viewport { flex:1; min-height:120px; display:flex; align-items:center; justify-content:center; padding:28px; overflow:hidden; background-image:radial-gradient(var(--ms-line) .65px,transparent .65px); background-size:16px 16px; }
.ms-editor .ms-canvas-wrap { position:relative; flex:none; box-shadow:0 16px 55px var(--ms-canvas-shadow); background-color:#e4e4e4; background-image:linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%); background-size:16px 16px; background-position:0 0,0 8px,8px -8px,-8px 0; }
.ms-editor canvas { display:block; width:100%; height:100%; touch-action:none; cursor:move; }
.ms-editor .ms-selection { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
.ms-editor .ms-selection polygon { fill:transparent; stroke:var(--ms-accent); stroke-width:1.4; vector-effect:non-scaling-stroke; }
.ms-editor .ms-selection circle { fill:var(--ms-panel); stroke:var(--ms-accent); stroke-width:1; vector-effect:non-scaling-stroke; }
.ms-editor .ms-snap-guides line { stroke:var(--ms-accent); stroke-width:1; stroke-dasharray:4 3; vector-effect:non-scaling-stroke; }
.ms-editor .ms-alignment { margin-bottom:12px; }
.ms-editor .ms-alignment .ms-actions { gap:0; }
.ms-editor .ms-alignment button { min-width:0; padding:6px 3px; }
.ms-editor .ms-timeline { flex:none; border-top:1px solid var(--ms-line); background:var(--ms-panel); padding:0 14px; }
.ms-editor .ms-timeline>summary { display:flex; align-items:center; gap:9px; cursor:pointer; min-height:44px; list-style:none; color:var(--ms-muted); }
.ms-editor .ms-timeline>summary strong { color:var(--ms-text); font-size:13px; font-weight:500; }
.ms-editor .ms-timeline>summary>span { font-size:12px; }
.ms-editor .ms-timeline>summary>.ms-icon:last-child { margin-left:auto; transition:transform 220ms cubic-bezier(.2,.8,.2,1); }
.ms-editor details[open]>summary>.ms-icon:last-child { transform:rotate(180deg); }
.ms-editor .ms-timeline[data-expanded=false]>summary>.ms-icon:last-child { transform:rotate(0); }
.ms-editor .ms-timeline[data-expanded=true]>summary>.ms-icon:last-child { transform:rotate(180deg); }
.ms-editor .ms-time-controls { display:flex; gap:10px; align-items:center; padding:0 0 6px; }
.ms-editor .ms-time-controls input[type=range] { flex:1; min-width:30px; accent-color:var(--ms-accent); }
.ms-editor .ms-time-label { font-variant-numeric:tabular-nums; font-size:12px; min-width:84px; }
.ms-editor .ms-track { margin:0 0 12px; font-size:12px; color:var(--ms-muted); }
.ms-editor .ms-light-card { margin-top:14px; padding-top:12px; border-top:1px solid var(--ms-line); }
.ms-editor .ms-light-card h4 { margin:0 0 8px; font-size:13px; color:var(--ms-text); }
.ms-editor .ms-section { padding:16px; border-bottom:1px solid var(--ms-line); }
.ms-editor .ms-disclosure>summary { display:flex; align-items:center; justify-content:space-between; list-style:none; cursor:pointer; font-size:13px; min-height:24px; font-weight:500; }
.ms-editor summary::-webkit-details-marker { display:none; }
.ms-editor .ms-disclosure-content { padding-top:12px; }
.ms-editor .ms-source .ms-disclosure { padding:8px 0 0; border:0; }
.ms-editor .ms-full-width { width:100%; }
.ms-editor .ms-source>.ms-hint { margin:9px 0 12px; }
.ms-editor .ms-field { display:flex; gap:10px; align-items:center; justify-content:space-between; margin:10px 0; min-width:0; }
.ms-editor .ms-field>span { color:var(--ms-muted); font-size:12px; flex:none; max-width:43%; }
.ms-editor .ms-field>.ms-field-label { color:var(--ms-muted); font-size:12px; flex:none; max-width:43%; }
.ms-editor .ms-field input:not([type=checkbox]),.ms-editor .ms-field select,.ms-editor .ms-field textarea { width:145px; min-width:0; min-height:36px; border:0; border-bottom:1px solid var(--ms-line); border-radius:0; background:transparent; padding:7px 8px; }
.ms-editor .ms-field input:not([type=checkbox]):hover,.ms-editor .ms-field select:hover { border-bottom-color:var(--ms-muted); }
.ms-editor .ms-field textarea { min-height:80px; resize:vertical; border:1px solid var(--ms-line); border-radius:4px; }
.ms-editor input[type=checkbox] { accent-color:var(--ms-accent); width:18px; height:18px; }
.ms-editor .ms-actions { display:flex; gap:7px; flex-wrap:wrap; margin-top:12px; }
.ms-editor .ms-actions button { font-size:12px; }
.ms-editor .ms-icon-row { flex-wrap:nowrap; }
.ms-editor .ms-icon-row button { flex:1; justify-content:center; min-height:40px; }
.ms-editor .ms-error { color:var(--ms-error); }
.ms-editor .ms-notice { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 16px; background:var(--ms-notice-bg); color:var(--ms-notice-text); border-bottom:1px solid var(--ms-notice-line); }
.ms-editor .ms-mobile-toggle,.ms-editor .ms-library-backdrop { display:none; }
.ms-editor .ms-device-thumbnail { display:flex; align-items:center; justify-content:center; flex:0 0 84px; width:84px; height:76px; overflow:hidden; border-radius:8px; background:var(--ms-panel); }
.ms-editor .ms-device-thumbnail img { object-fit:contain; max-width:none; flex:none; }
.ms-editor .ms-device { text-align:left; gap:10px; }
.ms-editor .ms-device>span:last-child { min-width:0; line-height:1.4; overflow-wrap:anywhere; }
.ms-editor .ms-device-preview { display:flex; align-items:center; gap:10px; margin:8px 0; font-size:12px; line-height:1.5; }
.ms-editor .ms-hidden { display:none!important; }
.ms-editor .ms-sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
.ms-editor .ms-properties-header { position:sticky; top:0; z-index:3; padding:16px; border-bottom:1px solid var(--ms-line); background:var(--ms-panel); }
.ms-editor .ms-properties-heading { display:flex; align-items:center; gap:8px; }
.ms-editor .ms-properties-heading h2 { margin:0; font-size:16px; font-weight:600; }
.ms-editor .ms-layer-type { margin-left:auto; font-size:11px; color:var(--ms-muted); padding:2px 7px; border:1px solid var(--ms-line); border-radius:4px; }
.ms-editor .ms-properties-close,.ms-editor .ms-properties-toggle { display:none; }
.ms-editor .ms-layer-states { display:flex; justify-content:space-between; gap:18px; }
.ms-editor .ms-right .ms-layer-states .ms-field { flex-direction:row; align-items:center; gap:10px; margin:4px 0 0; width:auto; }
.ms-editor .ms-right[data-mode=layer] .ms-field { flex-wrap:wrap; position:relative; gap:6px; align-items:center; }
.ms-editor .ms-right[data-mode=layer] .ms-field>span { max-width:none; }
.ms-editor .ms-right[data-mode=layer] .ms-field>.ms-field-label { max-width:none; }
.ms-editor .ms-right[data-mode=layer] .ms-field-full { flex-direction:column; align-items:stretch; }
.ms-editor .ms-right[data-mode=layer] .ms-field :is(input:not([type=checkbox]),select,textarea) { color:var(--ms-text); width:100%; }
.ms-editor .ms-right[data-mode=layer] .ms-field>input:not([type=checkbox]) { width:54%; }
.ms-editor .ms-right[data-mode=layer] .ms-field-full>input:not([type=checkbox]) { width:100%; }
.ms-editor .ms-right[data-mode=layer] .ms-field select { white-space:normal; }
.ms-editor .ms-right[data-mode=layer] .ms-field :is(input,select,textarea):disabled { opacity:.5; cursor:not-allowed; }
.ms-editor .ms-right[data-mode=layer] .ms-field input[aria-invalid=true] { border-color:var(--ms-error); }
.ms-editor .ms-right .ms-field-error { flex-basis:100%; max-width:none; color:var(--ms-error); font-size:11px; }
.ms-editor .ms-right .ms-selected-value { font-size:11px; color:var(--ms-muted); overflow-wrap:anywhere; }
.ms-editor .ms-number-control { display:flex; align-items:center; gap:6px; width:54%; }
.ms-editor .ms-right[data-mode=layer] .ms-number-control input { flex:1; min-width:0; }
.ms-editor .ms-unit { flex:none; font-size:11px; color:var(--ms-muted); pointer-events:none; }
.ms-editor .ms-field-pair { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
.ms-editor .ms-right[data-mode=layer] .ms-field-pair .ms-field { flex-direction:column; align-items:stretch; min-width:0; }
.ms-editor .ms-right[data-mode=layer] .ms-field-pair .ms-number-control,.ms-editor .ms-right[data-mode=layer] .ms-field-pair .ms-field>input { width:100%; }
.ms-editor .ms-color-control { width:145px; display:flex; align-items:center; gap:8px; min-width:0; }
.ms-editor .ms-field>.ms-color-control { max-width:none; }
.ms-editor .ms-right[data-mode=layer] .ms-color-control { width:62%; }
.ms-editor .ms-color-control input.ms-color { flex:1; width:0; min-width:0; color:var(--ms-text); }
.ms-editor .ms-color-trigger { width:32px; min-width:32px; min-height:36px; padding:3px; }
.ms-editor .ms-color-swatch { width:24px; height:24px; border:1px solid var(--ms-line); border-radius:4px; flex:none; overflow:hidden; background:repeating-conic-gradient(#aaa 0% 25%,#eee 0% 50%) 0/10px 10px; }
.ms-editor .ms-color-swatch>span { display:block; width:100%; height:100%; }
.ms-editor .ms-color-dialog { width:min(320px,calc(100% - 24px)); max-height:calc(100dvh - 24px); margin:auto; padding:16px; overflow:auto; overscroll-behavior:contain; border:1px solid var(--ms-line); border-radius:8px; background:var(--ms-panel); color:var(--ms-text); box-shadow:0 20px 70px #0006; }
.ms-editor .ms-color-dialog::backdrop { background:#0006; }
.ms-editor .ms-color-heading { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
.ms-editor .ms-color-heading h2 { font-size:15px; font-weight:500; margin:0; }
.ms-editor .ms-color-heading button { min-width:36px; padding:5px; }
.ms-editor .ms-color-square { height:156px; position:relative; touch-action:none; cursor:crosshair; border-radius:4px; background-image:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent); }
.ms-editor .ms-color-square:focus-visible { outline:2px solid var(--ms-accent); outline-offset:3px; }
.ms-editor .ms-color-marker { position:absolute; width:12px; height:12px; transform:translate(-50%,-50%); border:2px solid #fff; border-radius:50%; box-shadow:0 0 0 1px #0008; pointer-events:none; }
.ms-editor .ms-color-dialog .ms-hint { font-size:11px; margin:9px 0 12px; }
.ms-editor .ms-color-slider-label { display:block; color:var(--ms-muted); font-size:12px; margin:12px 0; }
.ms-editor .ms-color-dialog input[type=range] { display:block; appearance:none; width:100%; height:16px; margin:8px 0; border-radius:8px; cursor:pointer; }
.ms-editor .ms-color-hue { background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00); }
.ms-editor .ms-color-alpha { background:linear-gradient(to right,rgba(var(--ms-picked-rgb),0),rgb(var(--ms-picked-rgb))),repeating-conic-gradient(#aaa 0% 25%,#eee 0% 50%) 0/8px 8px; }
.ms-editor .ms-color-dialog input[type=range]::-webkit-slider-thumb { appearance:none; width:14px; height:22px; background:#fff; border:1px solid #555; border-radius:4px; box-shadow:0 1px 3px #0006; }
.ms-editor .ms-color-dialog input[type=range]::-moz-range-thumb { width:12px; height:20px; background:#fff; border:1px solid #555; border-radius:4px; }
.ms-editor .ms-color-values { display:grid; grid-template-columns:minmax(0,1fr) 86px; gap:16px; }
.ms-editor .ms-color-values .ms-field { flex-direction:column; align-items:stretch; gap:4px; margin:10px 0; }
.ms-editor .ms-color-values .ms-field>span { max-width:none; }
.ms-editor .ms-color-dialog .ms-color-values .ms-field input { width:100%; }
.ms-editor .ms-color-preview { display:flex; height:32px; border:1px solid var(--ms-line); border-radius:4px; overflow:hidden; background:repeating-conic-gradient(#aaa 0% 25%,#eee 0% 50%) 0/10px 10px; }
.ms-editor .ms-color-preview>* { flex:1; border:0; padding:0; min-height:0; border-radius:0; overflow:hidden; }
.ms-editor .ms-color-preview>*>span { display:block; width:100%; height:100%; }
.ms-editor .ms-color-palette { display:grid; grid-template-columns:repeat(8,minmax(0,1fr)); gap:5px; margin:12px 0; }
.ms-editor .ms-color-preset { min-width:0; width:100%; min-height:28px; padding:0; border:1px solid var(--ms-line); overflow:hidden; background:repeating-conic-gradient(#aaa 0% 25%,#eee 0% 50%) 0/8px 8px; }
.ms-editor .ms-color-preset>span { display:block; width:100%; height:26px; }
.ms-editor .ms-color-dialog .ms-actions { justify-content:flex-end; }
.ms-editor .ms-right[data-mode=layer] .ms-section .ms-section { padding:12px 0 0; margin-top:12px; border-bottom:0; border-top:1px solid var(--ms-line); }
.ms-editor .ms-right[data-mode=layer] .ms-section .ms-section summary { font-size:12px; }
.ms-editor .ms-right[data-mode=layer] .ms-disclosure>summary { min-height:32px; }
.ms-editor .ms-right[data-mode=layer] .ms-device-preview { margin:10px 0; gap:10px; }
.ms-editor .ms-right[data-mode=layer] .ms-device-preview>span { min-width:0; white-space:normal; overflow-wrap:anywhere; }
.ms-editor .ms-properties-dialog { width:min(100%,560px); max-width:100%; height:min(84dvh,820px); max-height:calc(100dvh - 24px); margin:auto auto 0; padding:0; border:1px solid var(--ms-line); border-radius:16px 16px 0 0; background:var(--ms-panel); color:var(--ms-text); overflow:hidden; box-shadow:0 -12px 60px #0006; }
.ms-editor .ms-properties-dialog::backdrop { background:#0008; }
.ms-editor .ms-properties-dialog[open] { display:flex; }
.ms-editor .ms-properties-dialog .ms-right { display:block; width:100%; height:100%; max-height:none; border:0; overflow:auto; overscroll-behavior:contain; padding-bottom:env(safe-area-inset-bottom); }
@media(max-width:1200px) { .ms-editor { --ms-library-default-width:218px; } .ms-editor .ms-guide-intro { max-width:180px; } .ms-editor .ms-guide-intro>span { max-width:165px; } .ms-editor .ms-guide { gap:12px; } .ms-editor .ms-steps { gap:5px; } .ms-editor .ms-workspace { grid-template-columns:min(40vw,40%,var(--ms-library-width,var(--ms-library-default-width,238px))) minmax(180px,1fr) 280px; } .ms-editor.ms-inspector-hidden .ms-workspace { grid-template-columns:min(40vw,40%,var(--ms-library-width,var(--ms-library-default-width,238px))) minmax(180px,1fr) 0px; } .ms-editor .ms-field input:not([type=checkbox]),.ms-editor .ms-field select,.ms-editor .ms-field textarea { width:135px; } }
@media(max-width:1000px) { .ms-editor .ms-header { padding:10px 12px; } .ms-editor .ms-toolbar { margin-left:auto; } .ms-editor .ms-header>.ms-spacer { display:none; } .ms-editor .ms-guide-intro { display:none; } .ms-editor .ms-stage-bar .ms-dimensions { display:none; } .ms-editor .ms-viewport { padding:20px; } }
@media(max-width:820px) { .ms-editor .ms-workspace { grid-template-columns:minmax(180px,1fr) 280px; } .ms-editor.ms-inspector-hidden .ms-workspace { grid-template-columns:minmax(180px,1fr) 0px; } .ms-editor .ms-left { display:none; } .ms-editor .ms-mobile-toggle { display:inline-flex; } .ms-editor.ms-show-library .ms-left { display:flex; position:fixed; inset:0 auto 0 0; width:min(40vw,var(--ms-library-width,300px)); z-index:5; box-shadow:10px 0 30px #0006; } .ms-editor .ms-library-heading { display:flex; padding:12px 14px 0; } .ms-editor .ms-library-heading button { display:inline-flex; } .ms-editor.ms-show-library .ms-library-backdrop { display:block; position:fixed; inset:0; background:#0008; border:0; border-radius:0; z-index:4; width:100%; height:100%; } .ms-editor .ms-library-backdrop>* { display:none; } .ms-editor .ms-brand { margin-right:0; } .ms-editor .ms-header { gap:6px; } .ms-editor .ms-steps small { display:none; } .ms-editor .ms-guide { padding:10px 12px; } }
@media(max-width:560px) { .ms-editor { min-height:840px; height:auto; } .ms-editor .ms-workspace { display:flex; flex-direction:column; flex:auto; } .ms-editor .ms-stage { flex:1; min-height:390px; } .ms-editor .ms-viewport { min-height:260px; } .ms-editor .ms-right { max-height:450px; border-top:1px solid var(--ms-line); border-left:0; overflow:auto; } .ms-editor .ms-brand { font-size:15px; } .ms-editor .ms-toolbar { width:auto; display:flex; margin-left:auto; } .ms-editor .ms-toolbar button { font-size:12px; padding:8px 5px; gap:5px; min-height:40px; } .ms-editor .ms-toolbar button .ms-icon { width:15px; } .ms-editor .ms-guide { align-items:flex-start; gap:6px; } .ms-editor .ms-steps { flex-direction:column; gap:0; } .ms-editor .ms-guide-step { min-height:36px; padding:3px; gap:9px; } .ms-editor .ms-step-number { width:23px; height:23px; font-size:12px; } .ms-editor .ms-stage-bar { padding:8px; gap:5px; } .ms-editor .ms-stage-bar button { min-height:38px; } .ms-editor .ms-stage-bar .ms-spacer { display:none; } .ms-editor .ms-viewport { padding:14px; } .ms-editor .ms-timeline { padding:0 12px; } .ms-editor .ms-field input:not([type=checkbox]),.ms-editor .ms-field select,.ms-editor .ms-field textarea { width:56%; } .ms-editor .ms-tabs { padding:10px; } .ms-editor .ms-tabs button { min-height:40px; } }
@media(prefers-reduced-motion:reduce) { .ms-editor *, .ms-editor *::before,.ms-editor *::after,.ms-editor .ms-actions-dialog::backdrop,.ms-editor .ms-color-dialog::backdrop { animation:none!important; transition:none!important; scroll-behavior:auto!important; } }
@media(max-width:560px) {
  .ms-editor .ms-workspace>.ms-right { display:none; }
  .ms-editor .ms-properties-toggle { display:inline-flex; }
  .ms-editor .ms-properties-close { display:inline-flex; margin-left:auto; min-width:40px; min-height:40px; }
  .ms-editor .ms-properties-header { padding:12px 16px; }
  .ms-editor .ms-properties-dialog .ms-right { max-height:none; border:0; }
  .ms-editor .ms-properties-dialog .ms-section { padding:16px; }
  .ms-editor .ms-properties-dialog .ms-field :is(input,select,textarea) { font-size:16px; }
}
`;


