import { mountEditor, createScene, createMockup, createText, createMesh, createShape, createMaterialPreset, createSpatialSettings, SpatialRenderer, type SceneDocument, type EditorHandle } from '@mockup-studio/sdk';
import { openDraftStorage } from './drafts.js';

/** Original demo artwork, embedded and portable. No network image or font dependency. */
const analytics = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
<defs>
  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#6b8df4" stop-opacity=".24"/><stop offset="1" stop-color="#6b8df4" stop-opacity="0"/></linearGradient>
  <linearGradient id="mark"><stop stop-color="#6798f4"/><stop offset="1" stop-color="#4e6de0"/></linearGradient>
</defs>
<rect width="1200" height="760" fill="#f7f8fb"/>
<rect width="210" height="760" fill="#fff"/><path d="M210 0V760" stroke="#e8ebf1"/>
<rect x="28" y="30" width="30" height="30" rx="9" fill="url(#mark)"/><path d="M35 51L43 38L51 51M39 46H47" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
<g font-family="Arial,sans-serif"><text x="70" y="51" font-size="20" font-weight="700" fill="#182033">Northstar</text>
<text x="30" y="104" font-size="10" fill="#9aa2b3" letter-spacing="1.5">WORKSPACE</text>
<rect x="16" y="122" width="178" height="42" rx="8" fill="#edf2ff"/>
<g font-size="13"><text x="49" y="148" fill="#567be5" font-weight="700">Overview</text><text x="49" y="195" fill="#7c8596">Audience</text><text x="49" y="242" fill="#7c8596">Acquisition</text><text x="49" y="289" fill="#7c8596">Engagement</text><text x="49" y="336" fill="#7c8596">Reports</text></g>
<g stroke="#8a98b0" fill="none" stroke-width="1.5"><rect x="30" y="136" width="10" height="11" rx="2"/><circle cx="35" cy="183" r="5"/><path d="M30 231L35 226L40 231L35 236Z"/><path d="M30 282H40M30 278H40M30 286H36"/><rect x="30" y="324" width="10" height="12" rx="1"/></g>
<rect x="19" y="588" width="172" height="100" rx="10" fill="#f5f7fc"/>
<text x="32" y="614" font-size="12" font-weight="700" fill="#4c5870">Make room for growth</text><text x="32" y="634" font-size="10" fill="#8a94a8">Your next big insight awaits.</text><rect x="32" y="650" width="145" height="24" rx="5" fill="#fff" stroke="#e2e7f1"/><text x="63" y="666" font-size="10" fill="#637794">Explore reports →</text>
<circle cx="38" cy="723" r="13" fill="#e6edf9"/><text x="31" y="727" font-size="10" fill="#6681ac">AL</text><text x="60" y="720" font-size="11" fill="#536079">Alex Lee</text><text x="60" y="734" font-size="9" fill="#9aa3b5">Personal workspace</text>
<text x="249" y="43" font-size="11" fill="#9aa4b6">Workspace  /  <tspan fill="#59657c">Overview</tspan></text><circle cx="1147" cy="36" r="13" fill="#e8edf8"/><text x="1139" y="40" font-size="9" fill="#637fac">AL</text><path d="M235 66H1180" stroke="#e6e9f0"/>
<text x="249" y="113" font-size="26" font-weight="700" fill="#222c40">Your business, at a glance.</text><text x="249" y="138" font-size="12" fill="#919aac">Here's how your product is growing this month.</text>
<rect x="993" y="94" width="165" height="33" rx="6" fill="#fff" stroke="#e1e6ef"/><text x="1006" y="115" font-size="11" fill="#68768f">June 1 – June 30  ⌄</text>
<g fill="#fff" stroke="#e4e8f0"><rect x="249" y="166" width="214" height="112" rx="10"/><rect x="481" y="166" width="214" height="112" rx="10"/><rect x="713" y="166" width="214" height="112" rx="10"/><rect x="945" y="166" width="214" height="112" rx="10"/></g>
<g fill="#8893a8" font-size="11"><text x="268" y="192">TOTAL REVENUE</text><text x="500" y="192">ACTIVE USERS</text><text x="732" y="192">CONVERSION RATE</text><text x="964" y="192">AVG. SESSION</text></g>
<g fill="#253047" font-size="28" font-weight="700"><text x="268" y="231">$48,290</text><text x="500" y="231">24,816</text><text x="732" y="231">6.84<tspan font-size="18">%</tspan></text><text x="964" y="231">4m 32s</text></g>
<g fill="#48a487" font-size="10"><text x="268" y="257">↗ 18.6% <tspan fill="#a0a9ba">vs. last month</tspan></text><text x="500" y="257">↗ 12.8% <tspan fill="#a0a9ba">vs. last month</tspan></text><text x="732" y="257">↗ 2.4% <tspan fill="#a0a9ba">vs. last month</tspan></text><text x="964" y="257">↗ 8.2% <tspan fill="#a0a9ba">vs. last month</tspan></text></g>
<rect x="249" y="298" width="597" height="280" rx="10" fill="#fff" stroke="#e4e8f0"/>
<text x="270" y="330" font-size="14" font-weight="700" fill="#34415b">Revenue over time</text><text x="730" y="330" font-size="10" fill="#98a2b6">● <tspan fill="#677b9d">This month</tspan></text>
<g stroke="#eff1f6"><path d="M295 367H820M295 413H820M295 459H820M295 505H820"/></g>
<g fill="#a2acbe" font-size="9"><text x="268" y="370">15k</text><text x="268" y="416">10k</text><text x="273" y="462">5k</text><text x="279" y="508">0</text><text x="295" y="553">Jun 1</text><text x="420" y="553">Jun 8</text><text x="542" y="553">Jun 15</text><text x="667" y="553">Jun 22</text><text x="787" y="553">Jun 30</text></g>
<path d="M295 487C320 489 330 447 352 458S389 472 412 446S449 415 472 432S511 406 535 413S567 389 590 397S619 366 645 380S675 390 699 364S734 376 755 354S793 350 820 329V522H295Z" fill="url(#area)"/>
<path d="M295 487C320 489 330 447 352 458S389 472 412 446S449 415 472 432S511 406 535 413S567 389 590 397S619 366 645 380S675 390 699 364S734 376 755 354S793 350 820 329" fill="none" stroke="#7193ef" stroke-width="3" stroke-linecap="round"/>
<rect x="866" y="298" width="293" height="280" rx="10" fill="#fff" stroke="#e4e8f0"/><text x="886" y="330" font-size="14" font-weight="700" fill="#34415b">Traffic sources</text>
<circle cx="1011" cy="421" r="55" fill="none" stroke="#eef1f8" stroke-width="20"/><circle cx="1011" cy="421" r="55" fill="none" stroke="#7698ef" stroke-width="20" stroke-dasharray="188 346" transform="rotate(-90 1011 421)"/><circle cx="1011" cy="421" r="55" fill="none" stroke="#b4c3ef" stroke-width="20" stroke-dasharray="87 346" stroke-dashoffset="-188" transform="rotate(-90 1011 421)"/>
<text x="982" y="421" font-size="21" font-weight="700" fill="#3b4862">24.8k</text><text x="993" y="439" font-size="9" fill="#96a3ba">visitors</text>
<g font-size="10"><text x="897" y="522" fill="#7899ee">● <tspan fill="#8b97ad">Organic</tspan></text><text x="1035" y="522" fill="#7899ee">54%</text><text x="897" y="545" fill="#b4c3ef">● <tspan fill="#8b97ad">Direct</tspan></text><text x="1035" y="545" fill="#9daed3">25%</text></g>
<rect x="249" y="598" width="910" height="139" rx="10" fill="#fff" stroke="#e4e8f0"/><text x="270" y="630" font-size="14" font-weight="700" fill="#34415b">Top pages</text><text x="1068" y="630" font-size="10" fill="#7991c5">View all →</text><path d="M270 648H1138M270 691H1138" stroke="#eff1f6"/>
<g fill="#8996ad" font-size="10"><text x="270" y="675">/ product / analytics</text><text x="771" y="675">8,492 visitors</text><text x="1022" y="675">↗ 22.4%</text><text x="270" y="718">/ product / insights</text><text x="771" y="718">6,184 visitors</text><text x="1022" y="718">↗ 16.8%</text></g></g></svg>`;

const assetId = 'demo_northstar_original';
const scene = createScene({
  name: 'Northstar — product launch', width: 1440, height: 1080, duration: 4, fps: 30,
  background: { type: 'gradient', kind: 'linear', angle: 140, stops: [{ offset: 0, color: '#e4ecfa' }, { offset: .55, color: '#b8cbea' }, { offset: 1, color: '#8ba9d5' }] },
  assets: [{ id: assetId, kind: 'image', src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(analytics)}`, width: 1200, height: 760, name: 'Northstar · analytics.svg', mime: 'image/svg+xml' }],
  nodes: [
    createText({ name: 'Launch headline', text: 'Clarity is a competitive advantage.', x: 720, y: 122, width: 1200, height: 66, fontSize: 47, color: '#263b5c', fontWeight: 700 }),
    createText({ name: 'Launch subline', text: 'A new perspective on your product. Introducing Northstar.', x: 720, y: 191, width: 1080, height: 40, fontSize: 22, color: '#516c93', fontWeight: 400 }),
    createText({ name: 'Brand signature', text: 'NORTHSTAR  /  PRODUCT ANALYTICS', x: 720, y: 1014, width: 1000, height: 28, fontSize: 15, color: '#456187', fontWeight: 500 }),
    createMockup({ name: 'Northstar browser', assetId, deviceId: 'browser', x: 720, y: 609, width: 1110, height: 746, radius: 17, rotation: -4, tiltX: 4, tiltY: -7, style: 'default', fit: 'cover', frameColor: '#f1f5fc', borderColor: '#ffffffb3', lighting: .18, shadow: { color: '#233d69', opacity: .25, blur: 64, spread: -4, offsetX: 0, offsetY: 34 } }),
  ],
});

/** An original editorial still life: legible negative space, three distinct
 * volumes, and high-contrast artwork behind the lens to reveal true refraction. */
function createGlassStudio(): SceneDocument {
  const stripes = Array.from({ length: 25 }, (_, i) => `<rect x="${i * 28}" y="0" width="7" height="520" fill="#242c31"/>`).join('');
  const opticalArtwork = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="760" viewBox="0 0 700 760">
    <rect width="700" height="760" fill="#edece4"/>${stripes}
    <rect y="520" width="700" height="240" fill="#e66d44"/>
    <g font-family="Arial,sans-serif" font-weight="700" fill="#20282d"><text x="32" y="610" font-size="88" letter-spacing="-5">LIGHT /</text><text x="32" y="700" font-size="88" letter-spacing="-5">FORM 03</text></g></svg>`;
  const artworkId = 'prism_optical_artwork';
  const glass = { ...createMaterialPreset('glass'), roughness: .035, transmission: 1, thickness: 310, ior: 1.5, attenuationColor: '#dbf4e8', attenuationDistance: 1100, dispersion: .055 };
  const metal = { ...createMaterialPreset('metal'), color: '#b9a385', roughness: .17, metalness: 1, clearcoat: .65 };
  const ceramic = { ...createMaterialPreset('ceramic'), color: '#a99bbb', roughness: .22, clearcoat: .45 };
  return createScene({
    name: 'Prism — light & volume', width: 1440, height: 1080, duration: 4, fps: 30,
    background: { type: 'solid', color: '#f4f1e9' },
    spatial: createSpatialSettings({ ambientColor: '#fff5e6', ambientIntensity: .55, environmentIntensity: 1.05, exposure: 1, quality: 'high', shadows: true, shadowOpacity: .12,
      lights: [
        { id: 'studio_key', type: 'directional', color: '#fff1d7', intensity: 3.4, x: 300, y: 80, z: 2200, castShadow: true },
        { id: 'studio_rim', type: 'directional', color: '#dce8ff', intensity: 4.2, x: 1360, y: 230, z: 1600, castShadow: false },
        { id: 'studio_fill', type: 'point', color: '#ffe9da', intensity: 2, x: 540, y: 850, z: 650, castShadow: false },
      ] }),
    assets: [{ id: artworkId, kind: 'image', src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(opticalArtwork)}`, width: 700, height: 760, name: 'Prism · original optical study.svg', mime: 'image/svg+xml' }],
    nodes: [
      createText({ name: 'Studio edition', text: 'PRISM  /  MATERIAL STUDIES', x: 316, y: 130, width: 420, height: 26, fontSize: 16, fontWeight: 600, align: 'left', color: '#263036', z: -100 }),
      createText({ name: 'Editorial headline', text: 'Clarity,\nwith depth.', x: 352, y: 345, width: 500, height: 210, fontSize: 72, fontWeight: 700, align: 'left', color: '#20292e', z: -100 }),
      createText({ name: 'Studio description', text: 'An exploration of light, volume\nand the beauty of seeing through.', x: 323, y: 540, width: 440, height: 90, fontSize: 22, fontWeight: 400, align: 'left', color: '#67706f', z: -100 }),
      createShape({ name: 'Editorial rule', x: 305, y: 714, width: 400, height: 1, fill: '#c6c8c0', radius: 0, z: -100 }),
      createText({ name: 'Materials index', text: '01   OPTICAL GLASS\n02   BRUSHED CHAMPAGNE\n03   GLAZED CERAMIC', x: 309, y: 796, width: 408, height: 116, fontSize: 15, fontWeight: 500, align: 'left', color: '#596361', z: -100 }),
      createText({ name: 'Edition footer', text: 'REAL GEOMETRY.  A DIFFERENT PERSPECTIVE.', x: 377, y: 1000, width: 550, height: 25, fontSize: 13, fontWeight: 500, align: 'left', color: '#78817c', z: -100 }),
      createMockup({ name: 'Optical stripes & typography', deviceId: 'screenshot', assetId: artworkId, x: 1020, y: 590, width: 638, height: 693, z: -160, radius: 0, borderWidth: 0, lighting: 0, frameColor: '#edece4', shadow: { color: '#000000', opacity: 0, blur: 0, spread: 0, offsetX: 0, offsetY: 0 } }),
      createMesh({ name: '02 · Champagne metal', geometry: 'rounded-box', x: 1150, y: 355, z: 110, width: 230, height: 265, depth: 145, bevel: 36, rotation: -15, tiltX: 18, tiltY: -24, material: metal }),
      createMesh({ name: '03 · Glazed ceramic', geometry: 'cylinder', x: 797, y: 829, z: 115, width: 198, height: 210, depth: 198, segments: 48, rotation: 11, tiltX: 20, tiltY: -12, material: ceramic }),
      createMesh({ name: '01 · Optical glass lens', geometry: 'sphere', x: 978, y: 593, z: 320, width: 372, height: 372, depth: 360, segments: 48, material: glass }),
    ],
  });
}

const host = document.querySelector<HTMLElement>('#editor');
if (!host) throw new Error('Demo editor container is missing.');
const storage = await openDraftStorage().catch(() => undefined);
let restoreFailed = false;
const restore = async (mode: '2d' | '3d') => storage?.read(mode).catch(() => { restoreFailed = true; return undefined; });
let current: '2d' | '3d' = '2d', flatScene = await restore('2d') ?? scene, spatialScene = await restore('3d');
let pendingSaves = 0, saveRevision = 0;
const dirtyModes = new Set<'2d' | '3d'>();
const modeRevision = { '2d': 0, '3d': 0 };
const persist = (next: SceneDocument) => {
  const mode = current; if (mode === '2d') flatScene = next; else spatialScene = next;
  dirtyModes.add(mode);
  const revision = ++saveRevision; modeRevision[mode] = revision;
  if (!storage) return;
  pendingSaves++;
  void storage.write(mode, next).then(() => {
    if (revision !== modeRevision[mode]) return;
    dirtyModes.delete(mode);
  }).catch(() => {
  }).finally(() => { pendingSaves--; });
};
const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
const editor: EditorHandle = mountEditor(host, {
  scene: flatScene, theme, rendererFactory: canvas => new SpatialRenderer(canvas), onChange: persist,
  onThemeChange: theme => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#ffffff' : '#242424');
    try { localStorage.setItem('mockup-studio-theme', theme); } catch { /* Theme switching still works without persistence. */ }
  },
  onError: (error: Error) => console.warn('[Device Mockup Studio]', error.message),
});
// These workspace controls belong to the demo; share its existing editor header.
const workspaces = document.querySelector<HTMLElement>('.demo-scenes');
const header = host.querySelector<HTMLElement>('.ms-header');
if (header && workspaces) {
  const actions = header.querySelector('.ms-toolbar');
  header.classList.add('ms-demo-header'); header.insertBefore(workspaces, actions); workspaces.hidden = false;
}
const spatialButton = document.querySelector<HTMLButtonElement>('#spatial-demo');
const flatButton = document.querySelector<HTMLButtonElement>('#flat-demo');
function switchStudio(next: '2d' | '3d'): void {
  if (current === next) return;
  if (current === '2d') flatScene = editor.getScene(); else spatialScene = editor.getScene();
  const previous = current;
  current = next;
  try { editor.setScene(next === '2d' ? flatScene : spatialScene ??= createGlassStudio(), false); }
  catch (error) { current = previous; throw error; }
  flatButton?.setAttribute('aria-pressed', String(next === '2d'));
  spatialButton?.setAttribute('aria-pressed', String(next === '3d'));
}
if (spatialButton) spatialButton.onclick = () => switchStudio('3d');
if (flatButton) flatButton.onclick = () => switchStudio('2d');
// Retain the original integration-test hook; all scene/render operations above use SDK APIs.
Object.assign(window, { mockupStudio: editor });
window.addEventListener('beforeunload', event => {
  if (pendingSaves || dirtyModes.size) { event.preventDefault(); event.returnValue = ''; }
});
window.addEventListener('pagehide', () => {
  if (spatialButton) spatialButton.onclick = null;
  if (flatButton) flatButton.onclick = null;
  editor.destroy();
  storage?.close();
}, { once: true });
