import { createMaterialPreset, createMesh, createMockup, createShape, createSpatialSettings, createText, uid, } from '@bookklik/device-mockup-studio-core';
import { getDevice } from './devices.js';
/** Shared drawing primitives only. Art direction and responsive placement belong to each design. */
export class TemplateContext {
    scene;
    mediaIds;
    previous;
    w;
    h;
    u;
    wide;
    tall;
    constructor(scene, mediaIds, previous) {
        this.scene = scene;
        this.mediaIds = mediaIds;
        this.previous = previous;
        this.w = scene.width;
        this.h = scene.height;
        this.u = Math.min(this.w, this.h);
        this.wide = this.w / this.h >= 1.25;
        this.tall = this.w / this.h < .85;
    }
    n(landscape, square, portrait) { return this.wide ? landscape : this.tall ? portrait : square; }
    background(color) { this.scene.background = { type: 'solid', color }; }
    rect(name, x, y, width, height, fill, options = {}) {
        const node = createShape({ name: `Artwork · ${name}`, x: x * this.w, y: y * this.h, width: Math.max(.001, width * this.w), height: Math.max(.001, height * this.h), fill, radius: 0, ...options });
        this.scene.nodes.push(node);
        return node;
    }
    disc(name, x, y, diameter, fill, options = {}) {
        const node = this.rect(name, x, y, diameter * this.u / this.w, diameter * this.u / this.h, fill, options);
        node.shape = 'ellipse';
        return node;
    }
    ring(name, x, y, diameter, color, thickness = .0015, options = {}) {
        const node = this.disc(name, x, y, diameter, 'transparent', options);
        node.shape = 'ring';
        node.stroke = color;
        node.strokeWidth = this.u * thickness;
        return node;
    }
    line(name, x1, y1, x2, y2, color, thickness = .001, z = 0) {
        const dx = (x2 - x1) * this.w, dy = (y2 - y1) * this.h;
        return this.rect(name, (x1 + x2) / 2, (y1 + y2) / 2, Math.hypot(dx, dy) / this.w, this.u * thickness / this.h, color, { rotation: Math.atan2(dy, dx) * 180 / Math.PI, z });
    }
    /** Conservative Latin advance estimate; browser review checks actual bundled font metrics. */
    advance(content, font) {
        return [...content].reduce((width, char) => width + (font === 'JetBrains Mono' ? .61 : /[MW@%&]/.test(char) ? .94 : /[ilIjtfr.,'!:;| ]/.test(char) ? .34 : /[A-Z0-9]/.test(char) ? .72 : .60), 0);
    }
    text(name, content, x, y, width, size, options = {}) {
        const font = options.font ?? 'Inter', lines = content.split('\n');
        const fontSize = Math.max(1, Math.min(2000, this.u * size, this.w * width / Math.max(1, ...lines.map(line => this.advance(line, font))), (1 - y) * this.h / (lines.length * 1.22 + .18)));
        const height = fontSize * (lines.length * 1.22 + .15);
        const node = createText({ name, text: content, x: this.w * (x + width / 2), y: this.h * y + height / 2, width: width * this.w, height,
            fontSize, fontFamily: font, color: options.color ?? '#243632', fontWeight: options.weight ?? 400, align: options.align ?? 'left', rotation: options.rotation ?? 0, z: options.z ?? 0 });
        this.scene.nodes.push(node);
        return node;
    }
    /** Independent text lines allow display leading without adding fields to the scene format. */
    headline(lines, x, y, width, size, options = {}, leading = 1.02) {
        const font = options.font ?? 'Inter';
        const fitted = Math.min(size, 2000 / this.u, this.w * width / Math.max(1, ...lines.map(line => this.advance(line, font))) / this.u, (1 - y) * this.h / ((lines.length - 1) * leading + 1.4) / this.u);
        return lines.map((line, i) => this.text(i === 0 ? 'Headline · make it yours' : `Headline · line ${i + 1}`, line, x, y + fitted * this.u / this.h * leading * i, width, fitted, options));
    }
    label(content, x, y, width, color = '#52665e', options = {}) {
        return this.text(`Caption · ${content.slice(0, 28)}`, content, x, y, width, .011, { font: 'JetBrains Mono', color, weight: 500, ...options });
    }
    media(deviceId, index, x, y, boxWidth, boxHeight, options = {}) {
        const device = getDevice(deviceId), width = Math.max(.001, Math.min(this.w * boxWidth, this.h * boxHeight * device.aspect));
        const samples = this.mediaIds.every(id => id.startsWith('studio-template-sample-'));
        const assetId = samples ? this.mediaIds.find(id => id.endsWith(device.aspect < 1 ? 'portrait' : 'wide')) ?? this.mediaIds[0] : this.mediaIds[index % this.mediaIds.length];
        const timing = this.previous.find(node => node.assetId === assetId);
        const node = createMockup({ name: index === 0 ? 'Hero · replace screenshot' : `Screen ${index + 1} · replace screenshot`, deviceId, assetId,
            x: this.w * x, y: this.h * y, width, height: Math.max(.001, width / device.aspect), rotation: options.rotation ?? 0, tiltX: options.tiltX ?? 0, tiltY: options.tiltY ?? 0, z: options.z ?? 0,
            style: 'default', frameColor: options.dark ? '#222936' : '#f5f6ef', borderColor: options.dark ? '#ffffff25' : '#ffffffb3', radius: this.u * .012, lighting: .14,
            shadow: { color: options.dark ? '#000000' : '#243c3a', opacity: options.shadow ?? (options.dark ? .4 : .20), blur: this.u * .04, spread: 0, offsetX: 0, offsetY: this.u * .025 },
            videoStart: timing?.videoStart ?? 0, playbackRate: timing?.playbackRate ?? 1, videoLoop: timing?.videoLoop ?? true,
        });
        this.scene.nodes.push(node);
        return node;
    }
    material(kind, color, overrides = {}) {
        const material = { ...createMaterialPreset(kind), color, ...overrides };
        material.thickness = Math.min(1000, material.thickness);
        return material;
    }
    mesh(name, geometry, x, y, width, height, depth, material, options = {}) {
        const node = createMesh({ name, geometry, x: x * this.w, y: y * this.h, width: Math.max(.001, width * this.u), height: Math.max(.001, height * this.u), depth: Math.max(.1, Math.min(4096, depth * this.u)),
            bevel: Math.min(1024, this.u * .025), segments: 48, material, z: this.u * .2, ...options });
        this.scene.nodes.push(node);
        return node;
    }
    lights(options) {
        const lights = options.lights?.map(light => ({ ...light, id: uid('template_light'),
            x: Math.max(-32768, Math.min(32768, light.x)), y: Math.max(-32768, Math.min(32768, light.y)), z: Math.max(-4096, Math.min(8192, light.z)),
        }));
        this.scene.spatial = createSpatialSettings({ quality: 'high', ...options, ...(lights ? { lights } : {}) });
    }
}
//# sourceMappingURL=template-context.js.map