/** Small DOM helpers: user-supplied strings are always text, never HTML. */
export declare function element<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className?: string, text?: string): HTMLElementTagNameMap[K];
export declare function button(doc: Document, label: string, action: () => void, className?: string): HTMLButtonElement;
export type Choice = string | {
    value: string;
    label: string;
};
export declare function field(doc: Document, parent: HTMLElement, label: string, input: HTMLElement): void;
export declare function select(doc: Document, choices: readonly Choice[], value: string, change: (value: string) => void): HTMLSelectElement;
export declare function text(doc: Document, value: string, change: (value: string) => void, multiline?: boolean): HTMLInputElement | HTMLTextAreaElement;
export declare function number(doc: Document, value: number, change: (value: number) => void, min: number, max: number, step?: number): HTMLInputElement;
export declare function color(doc: Document, value: string, change: (value: string) => void): HTMLInputElement;
export declare function check(doc: Document, value: boolean, change: (value: boolean) => void): HTMLInputElement;
export declare function section(doc: Document, parent: HTMLElement, title: string): HTMLElement;
export declare function disclosure(doc: Document, parent: HTMLElement, title: string, open?: boolean): HTMLElement;
/** Layer-only editing semantics; canvas controls retain their existing behavior. */
export declare function enhanceLayerFields(parent: HTMLElement): void;
//# sourceMappingURL=dom.d.ts.map