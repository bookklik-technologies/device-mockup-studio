import { assertScene, cloneScene, createScene, StudioError } from '@bookklik/device-mockup-studio/core';
import { getPresets } from './compositions.js';
import { TemplateContext } from './template-context.js';
import { deviceDesigns } from './template-designs.js';
import { materialDesigns } from './template-materials.js';
/** Fresh descriptors; identifiers and legacy composition APIs remain compatible. */
export function getTemplates(options = {}) {
    const legacy = new Map(getPresets().map(preset => [preset.id, preset]));
    const templates = Object.entries(deviceDesigns).map(([id, design]) => ({
        id, name: legacy.get(id).name, category: legacy.get(id).category, workspace: '2d', description: design.description,
    }));
    templates.push(...Object.entries(materialDesigns).map(([id, design]) => ({ id, name: design.name, category: design.category, workspace: '3d', description: design.description })));
    return templates.filter(template => !options.workspace || template.workspace === options.workspace);
}
// Original vector artwork, embedded in portable projects. No network dependencies.
function sampleAsset(portrait) {
    const w = portrait ? 800 : 1200, h = portrait ? 1400 : 760;
    const svg = portrait
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1400"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#e5efca"/><stop offset="1" stop-color="#97b9a2"/></linearGradient></defs><rect width="800" height="1400" fill="#f7f5ef"/><g fill="#223b32" font-family="sans-serif"><text x="64" y="105" font-size="28">FORMA / STUDIO</text><text x="64" y="235" font-size="70" font-weight="700">Space to</text><text x="64" y="318" font-size="70" font-weight="700">be yourself.</text><text x="64" y="385" font-size="23">Objects for a considered everyday.</text></g><rect x="40" y="445" width="720" height="660" rx="30" fill="url(#g)"/><ellipse cx="405" cy="1010" rx="210" ry="40" fill="#263f3225"/><rect x="244" y="600" width="300" height="400" rx="120" fill="#e9eee0"/><ellipse cx="394" cy="620" rx="145" ry="55" fill="#f8faef"/><ellipse cx="394" cy="615" rx="100" ry="30" fill="#a9b8a1"/><path d="M340 605Q220 450 320 490Q390 500 390 610M390 590Q470 430 490 470Q530 530 390 610" fill="#41694c"/><text x="64" y="1190" font-size="32" font-family="sans-serif" fill="#223b32">Find your everyday ritual.</text><rect x="64" y="1240" width="672" height="84" rx="42" fill="#223b32"/><text x="305" y="1293" font-size="27" font-family="sans-serif" fill="#fff">Explore collection</text></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760"><rect width="1200" height="760" fill="#f6f7f2"/><rect width="210" height="760" fill="#e9eee5"/><g font-family="sans-serif" fill="#254537"><text x="30" y="65" font-size="29" font-weight="700">forma.</text><text x="30" y="150" font-size="17">Overview</text><text x="30" y="204" font-size="17">Collections</text><text x="30" y="258" font-size="17">Your audience</text><text x="30" y="312" font-size="17">Insights</text><text x="260" y="80" font-size="17">YOUR WORKSPACE / OVERVIEW</text><text x="260" y="152" font-size="44" font-weight="700">Good things are growing.</text><text x="260" y="193" font-size="19" fill="#6f8277">A little clarity for your everyday.</text></g><g fill="#fff" stroke="#dce3d9"><rect x="260" y="235" width="270" height="135" rx="16"/><rect x="555" y="235" width="270" height="135" rx="16"/><rect x="850" y="235" width="295" height="135" rx="16"/><rect x="260" y="400" width="885" height="310" rx="16"/></g><g font-family="sans-serif" fill="#718277" font-size="17"><text x="285" y="275">Total revenue</text><text x="580" y="275">Active members</text><text x="875" y="275">Growth this month</text><text x="290" y="447">YOUR PROGRESS</text></g><g font-family="sans-serif" font-size="38" font-weight="700" fill="#254537"><text x="285" y="337">$48,290</text><text x="580" y="337">24,816</text><text x="875" y="337">+18.6%</text></g><path d="M290 650H1110M290 580H1110M290 510H1110" stroke="#edf0e8"/><path d="M290 646Q360 630 410 605T530 578T650 584T770 535T890 520T1010 475L1110 486V680H290Z" fill="#a4c5a84d"/><path d="M290 646Q360 630 410 605T530 578T650 584T770 535T890 520T1010 475L1110 486" fill="none" stroke="#60876a" stroke-width="7"/></svg>`;
    return { id: `studio-template-sample-${portrait ? 'portrait' : 'wide'}`, kind: 'image', name: `Forma · sample ${portrait ? 'poster' : 'dashboard'}`, width: w, height: h, mime: 'image/svg+xml', src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
}
/** Replaces the composition, retaining project metadata, media and video playback settings. */
export function applyTemplate(scene, templateId, options = {}) {
    const descriptor = getTemplates().find(template => template.id === templateId);
    if (!descriptor)
        throw new StudioError('UNKNOWN_TEMPLATE', `Unknown scene template: ${templateId}`);
    const output = cloneScene(scene);
    const oldMockups = output.nodes.filter((node) => node.type === 'mockup');
    const orderedIds = [options.assetId, ...oldMockups.map(node => node.assetId), ...output.assets.map(asset => asset.id)];
    const ids = [...new Set(orderedIds.filter((id) => !!id && output.assets.some(asset => asset.id === id)))];
    if (!ids.length) {
        for (const portrait of [false, true]) {
            const asset = sampleAsset(portrait);
            output.assets.push(asset);
            ids.push(asset.id);
        }
    }
    output.nodes = [];
    output.tracks = [];
    delete output.spatial;
    output.effects = createScene().effects;
    const context = new TemplateContext(output, ids, oldMockups);
    if (descriptor.workspace === '2d') {
        const original = getPresets().find(preset => preset.id === templateId).apply(createScene());
        output.background = original.background;
        output.effects.noise = Math.min(.025, original.effects.noise);
        deviceDesigns[templateId].build(context);
    }
    else
        materialDesigns[templateId].build(context);
    assertScene(output);
    return output;
}
//# sourceMappingURL=templates.js.map