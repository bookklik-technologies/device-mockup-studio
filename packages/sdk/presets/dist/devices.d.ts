import type { DeviceDefinition } from '@bookklik/device-mockup-studio-core';
export declare function getDevice(id: string): DeviceDefinition;
/** The default preserves SDK compatibility; editors can hide legacy generic frames. */
export declare function listDevices(options?: {
    includeLegacy?: boolean;
}): DeviceDefinition[];
/** Register or replace an original/custom definition without exposing mutable registry state. */
export declare function registerDevice(definition: DeviceDefinition): void;
export declare const framePresets: ReadonlyArray<{
    id: string;
    name: string;
    width: number;
    height: number;
}>;
//# sourceMappingURL=devices.d.ts.map