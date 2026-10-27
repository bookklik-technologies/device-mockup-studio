import families from './fonts.json' with { type: 'json' };
/** Names used in scenes. Hosts supply the corresponding @font-face stylesheet. */
export const fontFamilies = Object.freeze(families.map(family => Object.freeze({ ...family })));
//# sourceMappingURL=fonts.js.map