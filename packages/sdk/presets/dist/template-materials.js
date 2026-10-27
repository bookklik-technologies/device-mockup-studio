/** Material studies use different staging, lighting and text placement, not a shared still life. */
export const materialDesigns = {
    'optical-glass': {
        name: 'Optical Glass', category: 'Glass', description: 'A refractive lens over optical stripes, split display typography, and bright backlighting.',
        build(c) {
            c.background('#f4f1e9');
            c.lights({ ambientIntensity: .65, environmentIntensity: 1.15, shadowOpacity: .09, lights: [
                    { id: 'optical-back', type: 'directional', color: '#f1fff9', intensity: 5, x: c.w * .9, y: c.h * .12, z: c.u * 1.7, castShadow: false },
                    { id: 'optical-key', type: 'directional', color: '#fff1d6', intensity: 3, x: c.w * .08, y: c.h * .05, z: c.u * 2, castShadow: true },
                ] });
            const cx = c.n(.70, .61, .58), cy = c.n(.55, .62, .60);
            c.rect('optical paper', cx, cy, c.n(.46, .66, .76), c.n(.78, .49, .49), '#edece4', { z: -180 });
            for (let i = 0; i < 18; i++) {
                const x = cx - c.n(.21, .30, .34) + i * c.n(.024, .034, .038);
                c.rect(`optical stripe ${i}`, x, cy, c.n(.005, .008, .009), c.n(.76, .47, .47), '#25332d', { z: -175 });
            }
            const art = c.media('screenshot', 0, c.n(.79, .75, .74), c.n(.77, .70, .69), c.n(.22, .32, .36), c.n(.23, .21, .19), { z: -150, shadow: 0 });
            art.radius = 0;
            art.lighting = 0;
            c.label('OPTICAL / TRANSMISSION STUDY', .065, .06, .87, '#56645b', { z: c.u * .85 });
            c.headline(['SEE', 'THROUGH.'], .055, c.n(.26, .09, .13), c.n(.54, .88, .89), c.n(.11, .095, .11), { font: 'Manrope', color: '#263036', weight: 700, z: c.u * .85 }, .98);
            const glass = c.material('glass', '#e4f4ed', { transmission: 1, roughness: .025, thickness: c.u * .34, attenuationColor: '#c7e7d9', attenuationDistance: c.u * 1.2, dispersion: .06 });
            c.mesh('Hero · Optical Glass', 'sphere', cx, cy, c.n(.56, .55, .61), c.n(.56, .55, .61), .36, glass, { z: c.u * .35, tiltY: -16 });
            c.label('LIGHT BECOMES THE MATERIAL', .065, .91, .87, '#56645b', { z: c.u * .85 });
        },
    },
    'champagne-metal': {
        name: 'Champagne Metal', category: 'Metal', description: 'A single metallic sculpture above an architectural pedestal, with a small editorial artwork inset.',
        build(c) {
            c.background('#eae1d4');
            c.lights({ ambientColor: '#fff2db', ambientIntensity: .35, environmentIntensity: 1.45, shadowOpacity: .23, lights: [
                    { id: 'champagne-key', type: 'directional', color: '#ffe2ad', intensity: 4.8, x: c.w * .12, y: -c.h * .15, z: c.u * 2.4, castShadow: true },
                    { id: 'champagne-rim', type: 'directional', color: '#fff9ee', intensity: 2.4, x: c.w * .95, y: c.h * .4, z: c.u * .7, castShadow: false },
                ] });
            const cx = c.n(.72, .68, .65), cy = c.n(.45, .55, .55);
            c.mesh('Architecture · sandstone pedestal', 'box', cx, c.n(.79, .82, .73), c.n(.53, .53, .60), c.n(.24, .20, .23), .30, c.material('ceramic', '#ccbaa0', { roughness: .8, clearcoat: 0 }), { z: c.u * .07, tiltX: 8, tiltY: -14 });
            const inset = c.media('screenshot', 0, c.n(.17, .20, .20), c.n(.72, .70, .70), c.n(.20, .25, .26), c.n(.22, .20, .18), { shadow: .1, z: 0 });
            inset.radius = 0;
            c.headline(['A new kind', 'of precious.'], .065, c.n(.15, .10, .13), c.n(.48, .85, .86), c.n(.088, .08, .088), { font: 'Fraunces', color: '#463c2f', weight: 400, z: c.u * .85 }, 1.0);
            c.label('CHAMPAGNE / CAST IN LIGHT', .065, .06, .88, '#8b6943', { z: c.u * .85 });
            c.text('Supporting copy', 'Warmth. Weight.\nA lasting impression.', .065, c.n(.47, .48, .43), .33, .021, { font: 'Lora', color: '#6d5a43', z: c.u * .85 });
            c.mesh('Hero · Champagne Metal', 'torus', cx, cy, c.n(.58, .52, .65), c.n(.58, .52, .65), .21, c.material('metal', '#c6ac82', { roughness: .17 }), { z: c.u * .30, tiltX: 20, tiltY: -27, rotation: -13 });
            c.line('edition rule', .065, .92, .93, .92, '#8b694360', .001, c.u * .85);
        },
    },
    'glazed-ceramic': {
        name: 'Glazed Ceramic', category: 'Ceramic', description: 'A vertical ceramic totem with oversized serif lettering and a quiet exhibition label.',
        build(c) {
            c.background('#eee9f1');
            c.lights({ ambientIntensity: .8, environmentIntensity: .75, shadowOpacity: .12, lights: [
                    { id: 'ceramic-softbox', type: 'directional', color: '#fff8ff', intensity: 2.4, x: c.w * .15, y: -c.h * .1, z: c.u * 2.5, castShadow: true },
                    { id: 'ceramic-fill', type: 'directional', color: '#d9d2ff', intensity: 1.1, x: c.w * .9, y: c.h * .6, z: c.u * 1.4, castShadow: false },
                ] });
            const cx = c.n(.77, .80, .71), base = c.n(.76, .76, .73), mat = c.material('ceramic', '#a99bbb', { roughness: .24, clearcoat: .65 });
            c.mesh('Totem · foot', 'cylinder', cx, base, .38, .13, .32, mat, { z: c.u * .14, tiltX: 10, tiltY: 0 });
            c.mesh('Totem · middle', 'rounded-box', cx - .025, base - c.n(.23, .20, .15), .31, .35, .25, c.material('ceramic', '#c4b8cd', { roughness: .27 }), { z: c.u * .18, rotation: 9, tiltY: -16 });
            c.mesh('Hero · Glazed Ceramic', 'sphere', cx + .018, base - c.n(.51, .46, .34), .29, .31, .28, mat, { z: c.u * .2 });
            c.headline(['Form', 'follows', 'feeling.'], .06, c.n(.22, .19, .16), c.n(.52, .60, .60), .145, { font: 'Playfair Display', color: '#3e3548', weight: 500, z: c.u * .85 }, .98);
            c.label('GLAZED / NO. 03', .06, .065, .86, '#796187', { z: c.u * .85 });
            const art = c.media('screenshot', 0, .17, c.n(.82, .84, .84), .19, .13, { z: 0, shadow: 0 });
            art.radius = 0;
            c.text('Supporting copy', 'A study in soft surfaces\nand imperfect balance.', .06, .935, .85, .015, { color: '#796187', z: c.u * .85 });
        },
    },
    'soft-plastic': {
        name: 'Soft Plastic', category: 'Plastic', description: 'A Memphis playground of scattered geometry, graphic floor shapes, and bold rounded typography.',
        build(c) {
            c.background('#e2ebf1');
            c.lights({ ambientIntensity: 1.0, environmentIntensity: .55, shadowOpacity: .10, lights: [
                    { id: 'plastic-daylight', type: 'directional', color: '#ffffff', intensity: 2.1, x: c.w * .2, y: 0, z: c.u * 2.2, castShadow: true },
                    { id: 'plastic-peach', type: 'point', color: '#ffd2bf', intensity: 2.3, x: c.w * .9, y: c.h * .5, z: c.u * .8, castShadow: false },
                ] });
            c.rect('pink stage', .23, .65, .44, .41, '#eeb9ae', { rotation: -14, z: -160 });
            c.disc('blue floor disc', .76, .66, .72, '#b4c9de', { z: -160 });
            c.rect('yellow stripe', .48, .76, .90, .045, '#f1d276', { rotation: 13, z: -155 });
            c.media('screenshot', 0, .43, c.n(.66, .66, .66), .35, .23, { rotation: -9, z: -90, shadow: 0 });
            c.mesh('Play · peach cone', 'cone', .24, c.n(.57, .61, .61), .25, .36, .25, c.material('plastic', '#efab95'), { z: c.u * .2, tiltX: 12, tiltY: -12, rotation: -14 });
            c.mesh('Play · yellow cube', 'rounded-box', .72, c.n(.44, .49, .51), .19, .21, .18, c.material('plastic', '#f1d276'), { z: c.u * .25, tiltY: 30, rotation: 16 });
            c.mesh('Play · lilac ring', 'torus', .75, c.n(.80, .81, .80), .27, .27, .10, c.material('plastic', '#aa9acc'), { z: c.u * .18, tiltY: -28, rotation: 8 });
            c.mesh('Hero · Soft Plastic', 'sphere', .49, c.n(.78, .79, .78), .34, .34, .33, c.material('plastic', '#547ce5', { roughness: .32 }), { z: c.u * .35 });
            c.headline(['SERIOUS', 'ABOUT PLAY.'], .055, c.n(.12, .14, .14), .89, .155, { font: 'Sora', color: '#19354a', weight: 800, z: c.u * .85 }, .96);
            c.label('SMALL OBJECTS / BIG POSSIBILITIES', .06, .94, .88, '#19354a', { z: c.u * .85 });
        },
    },
    'dark-chrome': {
        name: 'Dark Chrome', category: 'Metal', description: 'Intersecting chrome rings, edge cropping, massive stacked type, and sharp rim lighting.',
        build(c) {
            c.background('#10151d');
            c.lights({ ambientColor: '#acbedb', ambientIntensity: .18, environmentIntensity: 1.9, shadowOpacity: .08, lights: [
                    { id: 'chrome-rim', type: 'directional', color: '#e1efff', intensity: 6.2, x: -c.w * .15, y: c.h * .15, z: c.u * .9, castShadow: false },
                    { id: 'chrome-strip', type: 'directional', color: '#829dcc', intensity: 3.8, x: c.w * 1.1, y: c.h * .8, z: c.u * 1.3, castShadow: true },
                    { id: 'chrome-top', type: 'point', color: '#ffffff', intensity: 2, x: c.w * .5, y: -c.h * .2, z: c.u * 1.4, castShadow: false },
                ] });
            const chrome = c.material('metal', '#c4d2e4', { roughness: .095, clearcoat: .8 });
            c.mesh('Chrome · outer ring', 'torus', c.n(.20, .25, .25), c.n(.55, .85, .67), c.n(.87, .80, .87), c.n(.87, .80, .87), .22, chrome, { z: c.u * .2, tiltX: 38, tiltY: 20, rotation: -24 });
            c.mesh('Hero · Dark Chrome', 'torus', c.n(.38, .42, .45), c.n(.68, .91, .79), .66, .66, .22, chrome, { z: c.u * .39, tiltX: -28, tiltY: -36, rotation: 27 });
            c.mesh('Chrome · small ring', 'torus', .16, c.n(.80, .94, .91), .36, .36, .13, chrome, { z: c.u * .28, tiltY: 50 });
            const art = c.media('screenshot', 0, c.n(.81, .82, .81), .86, .20, .15, { z: 0, shadow: 0, dark: true });
            art.radius = 0;
            c.headline(['PURE', 'PRESENCE.'], c.n(.47, .06, .07), c.n(.18, .085, .15), c.n(.49, .88, .87), .185, { font: 'Space Grotesk', color: '#f0f4fa', weight: 700, z: c.u * .95 }, .94);
            c.label('DARK CHROME / EDGE OF LIGHT', .06, .065, .87, '#a6bcd8', { z: c.u * .95 });
            c.label('POLISHED TO A DIFFERENT STANDARD', .06, .94, .88, '#a6bcd8', { z: c.u * .95 });
        },
    },
    'pastel-forms': {
        name: 'Pastel Forms', category: 'Ceramic', description: 'An airy balancing still life with asymmetrical forms, an integrated artwork plane, and a low-set headline.',
        build(c) {
            c.background('#f3eae0');
            c.lights({ ambientIntensity: .75, environmentIntensity: .9, shadowOpacity: .15, lights: [
                    { id: 'pastel-window', type: 'directional', color: '#fff5df', intensity: 3, x: c.w * .05, y: c.h * .05, z: c.u * 2, castShadow: true },
                    { id: 'pastel-fill', type: 'directional', color: '#e7ddff', intensity: 1.7, x: c.w * .9, y: c.h * .25, z: c.u * 1.6, castShadow: false },
                ] });
            const bottom = c.n(.64, .63, .59);
            c.media('screenshot', 0, c.n(.67, .65, .67), c.n(.45, .44, .42), .34, .26, { rotation: 8, z: -110, shadow: .08 });
            c.mesh('Balance · mint cube', 'rounded-box', .40, bottom, .29, .28, .25, c.material('ceramic', '#adc6b6'), { z: c.u * .13, tiltY: -18, rotation: -6 });
            c.mesh('Hero · Pastel Forms', 'sphere', .40, bottom - c.n(.25, .24, .17), .34, .34, .33, c.material('ceramic', '#df9f95', { roughness: .22 }), { z: c.u * .23 });
            c.mesh('Balance · lilac cone', 'cone', .43, bottom - c.n(.51, .48, .34), .22, .24, .21, c.material('ceramic', '#b5a8cb'), { z: c.u * .25, rotation: 10, tiltY: 8 });
            c.disc('graphic counterweight', .79, c.n(.67, .64, .63), .08, '#bc6d64', { z: -140 });
            c.label('A STUDY IN BALANCE', .07, .065, .86, '#846669', { z: c.u * .85 });
            c.headline(['A different kind', 'of balance.'], .07, c.n(.77, .77, .73), .86, .082, { font: 'Bricolage Grotesque', color: '#493c42', weight: 500, z: c.u * .85 }, .97);
        },
    },
};
//# sourceMappingURL=template-materials.js.map