/** Each builder owns its composition, type hierarchy and three aspect-ratio arrangements. */
export const deviceDesigns = {
    'aurora-field': {
        description: 'Airy asymmetry, overlapping color fields, and a quietly floating browser.',
        build(c) {
            c.disc('aqua field', .78, c.n(.39, .55, .58), c.n(1.15, 1.05, 1.2), '#72c9c244', { blur: 36 });
            c.disc('lilac field', .95, .85, .92, '#828be63d', { blur: 45 });
            c.label('AURORA / DIGITAL PERSPECTIVES', .07, .075, .75, '#315e59');
            c.headline(c.wide ? ['A clearer', 'perspective.'] : ['A clearer perspective.'], .07, c.n(.32, .15, .15), c.n(.32, .78, .85), .044, { font: 'Manrope', color: '#183e42', weight: 500 });
            c.text('Supporting copy', 'A little space for\nyour next big idea.', .07, c.n(.53, .29, .27), .4, .019, { color: '#315e59' });
            c.media('browser', 0, c.n(.73, .57, .56), c.n(.57, .63, .64), c.n(.73, .83, .92), c.n(.77, .57, .62), { rotation: -7, tiltY: -5 });
            c.label('ROOM TO THINK. ROOM TO CREATE.', .07, .91, .8, '#315e59');
        },
    },
    'midnight-signal': {
        description: 'A cinematic laptop reveal with a stacked headline and diagonal beams of light.',
        build(c) {
            c.background('#0b1123');
            c.rect('diagonal light beam', .78, .45, .22, 1.5, '#436bce22', { rotation: -34, blur: 36 });
            c.rect('narrow light beam', .66, .45, .025, 1.4, '#c2d8ff16', { rotation: -34, blur: 12 });
            c.disc('backlight', .82, .68, .85, '#2d4ca250', { blur: 45 });
            c.label('AFTER HOURS / 001', .07, .07, .7, '#99b8e9');
            c.headline(['YOUR NEXT', 'MOVE.'], .07, c.n(.23, .18, .18), c.n(.62, .85, .86), .11, { font: 'Space Grotesk', color: '#f1f5ff', weight: 700 }, .96);
            c.text('Supporting copy', 'Ideas do not keep office hours.', .07, c.n(.56, .43, .39), .7, .018, { color: '#afbdd9' });
            c.media('macbook-pro-14-m5', 0, c.n(.85, .75, .69), c.n(.81, .79, .7), c.n(1.12, 1.13, 1.18), c.n(.9, .72, .63), { rotation: -13, tiltX: 6, tiltY: -12, dark: true });
            c.label('A NEW SIGNAL IS COMING THROUGH', .07, .93, .85, '#99b8e9');
        },
    },
    'paper-margin': {
        description: 'A magazine cover with a generous serif masthead, columns, rules, and a folio.',
        build(c) {
            c.background('#f0eade');
            c.label('THE DESIGN JOURNAL', .06, .045, .6, '#595547');
            c.label('VOL. 03 / 2026', .72, .045, .23, '#595547', { align: 'right' });
            c.headline(['The considered', 'edition.'], .055, .105, .90, c.n(.115, .10, .108), { font: 'Lora', color: '#39372e', weight: 500 }, .95);
            const ruleY = c.n(.38, .34, .28);
            c.line('masthead rule', .06, ruleY, .94, ruleY, '#39372e', .0015);
            c.text('Supporting copy', 'A study in clarity.\nDesigned for the way\nwe live and work.', .06, c.n(.45, .40, .34), c.n(.25, .36, .36), .021, { font: 'Lora', color: '#595547' });
            c.text('Article column', 'Inside this issue\nForm. Function. Feeling.\nA new point of view.', c.n(.32, .06, .06), c.n(.45, .57, .49), c.n(.24, .36, .38), .015, { color: '#6b6657' });
            c.media('iphone-17-pro', 0, c.n(.76, .74, .68), c.n(.65, .65, .63), c.n(.33, .46, .55), c.n(.52, .56, .57), { rotation: 7, shadow: .16 });
            c.text('Artwork · folio number', '03', .06, c.n(.76, .78, .81), .28, .13, { font: 'Lora', color: '#a95b3f', weight: 400 });
            c.line('bottom rule', .06, .94, .94, .94, '#39372e', .001);
        },
    },
    'coral-current': {
        description: 'A cut-paper collage with skewed panels, layered screens, and a graphic stamp.',
        build(c) {
            c.rect('paper shadow', .53, .51, .8, .65, '#54283e18', { rotation: 7 });
            c.rect('cream paper', .5, .49, .8, .65, '#fff4dc', { rotation: 5 });
            c.rect('pink paper', .75, .61, .42, .54, '#ee8294', { rotation: -12 });
            c.media('iphone-17', 0, c.n(.40, .36, .32), c.n(.59, .61, .60), .36, c.n(.61, .58, .52), { rotation: -13 });
            c.media('pixel-10-pro', 1, c.n(.65, .65, .68), c.n(.65, .65, .67), .35, c.n(.62, .59, .52), { rotation: 11 });
            c.rect('headline strip', .46, c.n(.24, .23, .22), .92, c.n(.28, .27, .19), '#54283e', { rotation: -4 });
            c.headline(['GOOD THINGS', 'ARE MOVING.'], .09, c.n(.145, .15, .16), .80, .095, { font: 'DM Sans', color: '#fff4dc', weight: 800 }, .94);
            c.disc('stamp disc', .83, .84, .16, '#f8e7b8');
            c.ring('stamp outline', .83, .84, .145, '#9c4459', .002);
            c.text('Stamp · new', 'NEW', .765, .822, .13, .022, { font: 'DM Sans', color: '#9c4459', weight: 800, align: 'center', rotation: 12 });
            c.label('COLLECT A DIFFERENT PERSPECTIVE', .07, .935, .85, '#54283e');
        },
    },
    'cobalt-edition': {
        description: 'A brutalist typographic poster with hard divisions and an oversized cropped screen.',
        build(c) {
            c.background('#2546e8');
            c.rect('black index panel', .15, .055, .30, .11, '#101829');
            c.label('EDITION / 05', .04, .035, .24, '#d4f575');
            c.rect('lime vertical rail', .965, .5, .07, 1, '#d4f575');
            c.rect('black foundation', .47, .86, .94, .28, '#101829');
            c.media('browser', 0, c.n(.77, .72, .62), c.n(.96, .94, .72), c.n(.93, 1.02, 1.08), c.n(.69, .63, .57), { rotation: 0, dark: true, shadow: .1 });
            c.headline(['LESS', 'ORDINARY.'], .035, c.n(.14, .16, .16), .89, .205, { font: 'Bricolage Grotesque', color: '#ffffff', weight: 800 }, .92);
            c.label('MAKE A STATEMENT.', .04, c.n(.63, .57, .43), .45, '#d4f575');
            c.label('UNCOMPROMISING BY DESIGN', .04, .925, .72, '#ffffff');
        },
    },
    'lavender-drift': {
        description: 'An orbital study with concentric rings, arcing windows, and a low-set headline.',
        build(c) {
            for (const diameter of [.52, .83, 1.14, 1.45])
                c.ring(`orbit ${diameter}`, .62, c.n(.37, .37, .34), diameter, '#70539250', .0015);
            c.disc('orbit point', .19, .15, .045, '#705392');
            c.disc('small satellite', .90, .49, .075, '#fff5ff');
            c.media('browser', 1, c.n(.77, .74, .68), c.n(.28, .28, .29), c.n(.43, .49, .57), .29, { rotation: 12, tiltX: 6 });
            c.media('browser', 0, c.n(.42, .40, .39), c.n(.48, .49, .49), c.n(.55, .64, .70), .38, { rotation: -9, tiltY: -7 });
            c.headline(['Let the idea', 'find its orbit.'], .08, c.n(.68, .70, .72), .84, .082, { font: 'Plus Jakarta Sans', color: '#39294f', weight: 600 }, 1.02);
            c.label('LAVENDER DRIFT / NO FIXED POINT', .08, .93, .85, '#6b4b9d');
        },
    },
    'mint-archive': {
        description: 'An asymmetric Swiss archive with one dominant screen, three studies, and indexed captions.',
        build(c) {
            c.background('#d4e9dc');
            c.line('vertical grid', .64, .07, .64, .93, '#41785a75');
            c.line('top rule', .05, .13, .95, .13, '#244234', .002);
            c.label('MINT ARCHIVE', .05, .065, .5, '#244234');
            c.label('INDEX / 07', .74, .065, .21, '#244234', { align: 'right' });
            c.text('Artwork · archive index', '07', .05, c.n(.19, .18, .18), .35, .16, { font: 'Inter', color: '#41785a', weight: 400 });
            c.headline(['Every detail', 'belongs.'], .05, c.n(.42, .40, .35), .54, .063, { font: 'Inter', color: '#244234', weight: 600 });
            c.media('browser', 0, .33, c.n(.73, .71, .68), .55, c.n(.38, .38, .30), { shadow: .09 });
            const positions = c.tall ? [.29, .51, .75] : [.29, .53, .77];
            positions.forEach((y, i) => {
                c.label(`0${i + 1} / FIELD STUDY`, .69, y - .10, .27, '#41785a');
                c.media('browser', i + 1, .81, y, .25, c.n(.18, .18, .15), { shadow: .08 });
            });
            c.label('A COLLECTION OF CONSIDERED THINGS', .05, .935, .88, '#244234');
        },
    },
    'burnt-sienna': {
        description: 'An artisanal catalogue with an architectural arch, pedestal, and oversized serif type.',
        build(c) {
            const archX = c.n(.76, .74, .68), archY = c.n(.40, .59, .53);
            c.disc('arch crown', archX, archY, c.n(.57, .55, .70), '#e5af7c');
            c.rect('arch column', archX, c.n(.60, .73, .68), c.n(.32, .55, .70), c.n(.42, .32, .30), '#e5af7c');
            c.rect('pedestal shadow', archX, .85, c.n(.44, .65, .8), .10, '#49292155');
            c.rect('pedestal', archX, .82, c.n(.42, .63, .78), .10, '#c77d55');
            c.media('ipad-pro-11-m5', 0, archX, c.n(.51, .64, .59), c.n(.32, .45, .64), c.n(.65, .50, .54), { rotation: -5, shadow: .23 });
            c.headline(['Built with', 'intention.'], .06, c.n(.23, .10, .12), c.n(.56, .86, .86), c.n(.13, .10, .13), { font: 'Fraunces', color: '#fff0df', weight: 500 }, .96);
            c.label('OBJECTS / PURPOSE / EVERYDAY', .065, .055, .85, '#ffd1a9');
            c.text('Supporting copy', 'Considered from\nevery angle.', .065, c.n(.65, .50, .38), c.n(.30, .29, .32), .022, { font: 'Fraunces', color: '#fff0df' });
            c.label('THE SIENNA COLLECTION — 08', .065, .93, .84, '#ffd1a9');
        },
    },
    'split-dialogue': {
        description: 'A two-panel dialogue with mirrored screens, contrasting fields, and oversized indices.',
        build(c) {
            c.background('#e9e6df');
            c.rect('right half', .75, .5, .5, 1, '#26334f');
            c.text('Artwork · index 01', '01', .055, .11, .40, .20, { font: 'Sora', color: '#26334f', weight: 300 });
            c.text('Artwork · index 02', '02', .55, .11, .40, .20, { font: 'Sora', color: '#d6dcef', weight: 300 });
            c.media('iphone-17-pro', 0, .26, c.n(.62, .61, .59), .43, c.n(.70, .64, .57), { rotation: -7 });
            c.media('galaxy-s26-ultra', 1, .76, c.n(.62, .61, .59), .43, c.n(.70, .64, .57), { rotation: 7, dark: true });
            const y = c.n(.43, .45, .43);
            c.rect('headline bridge', .5, y, .90, c.n(.17, .13, .105), '#c1c8e3');
            c.headline(['BETTER TOGETHER'], .075, y - c.n(.073, .055, .042), .85, .12, { font: 'Sora', color: '#26334f', weight: 700, align: 'center' });
            c.label('TWO PERSPECTIVES.', .06, .91, .4, '#26334f');
            c.label('ONE GOOD IDEA.', .55, .91, .4, '#d6dcef');
        },
    },
    'gallery-noir': {
        description: 'A dark exhibition wall with one dominant artwork and a restrained museum caption.',
        build(c) {
            c.background('#17191b');
            c.rect('exhibition mount', c.n(.63, .53, .50), c.n(.43, .42, .39), c.n(.66, .82, .86), c.n(.70, .58, .52), '#292d2c');
            c.media('browser', 0, c.n(.63, .53, .50), c.n(.43, .42, .39), c.n(.58, .75, .80), c.n(.58, .50, .44), { dark: true, shadow: .12 });
            c.headline(['Let the work speak.'], .08, c.n(.83, .77, .73), .82, .036, { font: 'Playfair Display', color: '#f1eee5', weight: 500 });
            c.text('Supporting copy', 'Digital composition, 2026\nAn ongoing exploration of form and function.', .08, c.n(.90, .84, .79), .80, .014, { color: '#b7c3bb' });
            c.label('09 / GALLERY NOIR', .08, .06, .8, '#b7c3bb');
        },
    },
    'sunrise-portrait': {
        description: 'An app campaign with a sun disc, tall hero handset, and oversized background lettering.',
        build(c) {
            c.disc('sun disc', c.n(.75, .64, .64), c.n(.57, .58, .62), c.n(.95, .95, 1.14), '#f4a779');
            c.text('Artwork · sunrise word', 'RISE', .035, c.n(.10, .10, .12), .94, .23, { font: 'Outfit', color: '#b7644f', weight: 800 });
            c.media('iphone-17', 0, c.n(.71, .80, .77), c.n(.65, .66, .66), c.n(.49, .63, .84), c.n(.99, .91, .79), { rotation: 8 });
            c.headline(['Something', 'bright ahead.'], .07, c.n(.51, .52, .49), c.n(.41, .43, .43), .060, { font: 'Outfit', color: '#754339', weight: 700 });
            c.label('01 / A FRESH START', .07, .08, .85, '#754339');
            c.text('Benefit callout', 'Small moments.\nBrighter days.', .07, c.n(.76, .77, .76), .32, .020, { color: '#754339' });
        },
    },
    'prism-fan': {
        description: 'A Bauhaus arrangement of circles, diagonal planes, and a staggered three-screen fan.',
        build(c) {
            c.background('#e8d8de');
            c.rect('diagonal blue plane', .72, .55, .70, .94, '#8eafd0', { rotation: 24 });
            c.disc('coral circle', .23, c.n(.54, .54, .58), c.n(.65, .64, .75), '#d8776c');
            c.ring('black circle', .81, .17, .33, '#483753', .012);
            c.rect('black baseline', .5, .83, 1.15, .027, '#483753', { rotation: -9 });
            c.media('iphone-17', 1, .31, c.n(.61, .60, .62), .33, c.n(.63, .56, .48), { rotation: -17 });
            c.media('galaxy-s26', 2, .70, c.n(.58, .61, .61), .33, c.n(.64, .58, .50), { rotation: 18 });
            c.media('pixel-10-pro', 0, .51, c.n(.55, .56, .57), .37, c.n(.71, .64, .57), { rotation: -2 });
            c.headline(['FORM / PLAY'], .06, .075, .83, .095, { font: 'DM Sans', color: '#483753', weight: 800 });
            c.label('A DIFFERENT ARRANGEMENT', .09, .91, .80, '#483753', { rotation: -3 });
        },
    },
    'blueprint-wall': {
        description: 'A technical device drawing with dimension lines, detail insets, and numbered callouts.',
        build(c) {
            c.background('#112c43');
            for (let i = 1; i < 12; i++)
                c.line(`grid column ${i}`, i / 12, .05, i / 12, .95, '#80d4de12');
            for (let i = 1; i < 12; i++)
                c.line(`grid row ${i}`, .04, i / 12, .96, i / 12, '#80d4de12');
            c.headline(['A STUDY IN PRECISION'], .06, .065, .88, .047, { font: 'JetBrains Mono', color: '#e8f5ff', weight: 500 });
            c.label('FIG. 13 / SYSTEM OVERVIEW', .06, .16, .86, '#80d4de');
            const cx = c.n(.46, .46, .46), cy = c.n(.55, .53, .51);
            c.media('iphone-17-pro', 0, cx, cy, .44, c.n(.61, .57, .50), { dark: true, shadow: .08 });
            c.line('height dimension', .18, .26, .18, .81, '#80d4de', .0015);
            c.line('height tick top', .16, .26, .20, .26, '#80d4de');
            c.line('height tick bottom', .16, .81, .20, .81, '#80d4de');
            c.line('width dimension', .28, .85, .65, .85, '#80d4de', .0015);
            c.line('width tick left', .28, .83, .28, .87, '#80d4de');
            c.line('width tick right', .65, .83, .65, .87, '#80d4de');
            c.label('A / OUTER FRAME', .69, .27, .27, '#80d4de');
            c.media('browser', 1, .81, .40, .24, .18, { dark: true, shadow: 0 });
            c.line('detail leader', .60, .41, .71, .35, '#80d4de');
            c.label('B / INTERFACE', .69, .58, .27, '#80d4de');
            c.media('browser', 2, .81, .71, .24, .18, { dark: true, shadow: 0 });
            c.line('detail leader lower', .60, .65, .71, .66, '#80d4de');
            c.label('SCALE 1:1 / ALL DETAILS CONSIDERED', .06, .93, .88, '#80d4de');
        },
    },
    'quiet-mono': {
        description: 'Extreme restraint: a single device, one fine rule, and deliberately small typography.',
        build(c) {
            c.background('#e3e4e5');
            c.headline(['Less. But considered.'], .10, c.n(.14, .16, .17), .8, .031, { font: 'Inter', color: '#303536', weight: 400 });
            c.line('single rule', .10, c.n(.23, .25, .24), .20, c.n(.23, .25, .24), '#303536', .001);
            c.media('macbook-air-13-m5', 0, c.n(.65, .61, .57), c.n(.61, .60, .57), c.n(.57, .70, .79), c.n(.48, .47, .43), { shadow: .09 });
        },
    },
    'citrus-punch': {
        description: 'A kinetic poster with enormous type, a graphic starburst, and a diagonal device crop.',
        build(c) {
            c.background('#e4f369');
            const bx = c.n(.76, .90, .86), by = c.n(.20, .095, .075);
            for (let i = 0; i < 12; i++)
                c.rect(`starburst ray ${i}`, bx, by, c.n(.21, .16, .20), .012, '#243c23', { rotation: i * 15 });
            c.rect('diagonal dark bar', .53, .58, 1.35, c.n(.12, .10, .08), '#243c23', { rotation: -19 });
            c.media('iphone-17-pro', 0, c.n(.80, .88, .79), c.n(.73, .82, .74), c.n(.56, .67, .92), c.n(1.06, 1.0, .82), { rotation: 23 });
            c.headline(['STAND', 'OUT.'], .04, c.n(.13, .13, .15), c.n(.61, .72, .79), .215, { font: 'Bricolage Grotesque', color: '#243c23', weight: 800 }, .90);
            c.rect('annotation strip', .25, c.n(.73, .75, .71), .44, .075, '#f7ffc2', { rotation: -8 });
            c.text('Supporting copy', 'IMPOSSIBLE TO IGNORE', .045, c.n(.704, .724, .687), .40, .019, { font: 'JetBrains Mono', color: '#243c23', weight: 700, rotation: -8 });
            c.label('CITRUS / FULL VOLUME', .05, .94, .8, '#243c23');
        },
    },
    'rose-studio': {
        description: 'A luxury editorial with a full-height rose art panel and oversized serif typography.',
        build(c) {
            c.background('#eee0dc');
            c.rect('full height rose panel', c.n(.76, .73, .72), .5, c.n(.48, .54, .56), 1, '#b796a3');
            c.disc('studio light', c.n(.80, .79, .80), .40, .70, '#e9c9c466', { blur: 32 });
            c.media('ipad-air-11-m4', 0, c.n(.78, .78, .72), c.n(.50, .37, .47), c.n(.37, .44, .58), c.n(.78, .56, .58), { rotation: 4, shadow: .17 });
            c.label('ROSE / A STUDIO PERSPECTIVE', .06, .065, .83, '#73546c');
            c.headline(['A softer', 'point of view.'], .055, c.n(.49, .65, .74), c.n(.66, .83, .87), c.n(.123, .11, .123), { font: 'Lora', color: '#392d3c', weight: 400 }, .96);
            c.text('Supporting copy', 'Space for the beautifully unexpected.', .06, .91, .88, .016, { color: '#73546c' });
        },
    },
};
//# sourceMappingURL=template-designs.js.map