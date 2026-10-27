import families from './fonts.json' with { type: 'json' };

/** Names used in scenes. Hosts supply the corresponding @font-face stylesheet. */
export const fontFamilies: readonly Readonly<{ id: string; family: string; category: string; weights: string }>[] = Object.freeze(families.map(family => Object.freeze({ ...family })));
