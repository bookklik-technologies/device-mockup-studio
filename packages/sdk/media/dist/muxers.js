import { StudioError } from '@bookklik/device-mockup-studio/core';
const PAGE_SIZE = 64 * 1024;
/** A seekable, capped StreamTarget sink. Header rewrites overwrite bytes instead of appending corrupt data. */
class BoundedSink {
    limit;
    pages = new Map();
    length = 0;
    disposed = false;
    constructor(limit) {
        this.limit = limit;
    }
    write(data, position) {
        if (this.disposed)
            throw new StudioError('MUXER_DISPOSED', 'Muxer has been disposed.');
        const end = position + data.byteLength;
        if (!Number.isSafeInteger(position) || position < 0 || end > this.limit)
            throw new StudioError('EXPORT_SIZE_LIMIT', `Muxed output exceeds the ${this.limit} byte limit. Reduce duration, dimensions or bitrate.`);
        for (let offset = 0; offset < data.byteLength;) {
            const pageIndex = Math.floor((position + offset) / PAGE_SIZE), inPage = (position + offset) % PAGE_SIZE;
            let page = this.pages.get(pageIndex);
            if (!page) {
                page = new Uint8Array(Math.min(PAGE_SIZE, this.limit - pageIndex * PAGE_SIZE));
                this.pages.set(pageIndex, page);
            }
            const size = Math.min(data.byteLength - offset, page.length - inPage);
            page.set(data.subarray(offset, offset + size), inPage);
            offset += size;
        }
        this.length = Math.max(this.length, end);
    }
    read(position, size) {
        if (position < 0 || position + size > this.length)
            throw new StudioError('MUXER_HEADER', 'Container header is truncated.');
        const result = new Uint8Array(size);
        for (let i = 0; i < size; i++)
            result[i] = this.pages.get(Math.floor((position + i) / PAGE_SIZE))?.[(position + i) % PAGE_SIZE] ?? 0;
        return result;
    }
    blob(type) {
        const parts = [];
        for (let position = 0; position < this.length; position += PAGE_SIZE) {
            const size = Math.min(PAGE_SIZE, this.length - position), page = this.pages.get(position / PAGE_SIZE);
            parts.push(page ? page.subarray(0, size) : new Uint8Array(size));
        }
        return new Blob(parts, { type });
    }
    dispose() { this.disposed = true; this.pages.clear(); this.length = 0; }
}
// webm-muxer 5.1.4 writes Segment/Info/Duration as the LAST FRAME START, not end.
// Repair only that float64 metadata field. All blocks, cues and container structure come from the proven muxer.
// Parse element boundaries (never byte-search into encoded media) and fail closed on an unexpected layout.
function correctWebMDuration(sink, seconds) {
    const vint = (position, id) => {
        const first = sink.read(position, 1)[0];
        let size = 1;
        while (size <= 8 && !(first & 2 ** (8 - size)))
            size++;
        if (size > (id ? 4 : 8))
            throw new StudioError('MUXER_HEADER', 'Invalid WebM element header.');
        const bytes = sink.read(position, size);
        let value = id ? first : first & (2 ** (8 - size) - 1);
        for (let i = 1; i < size; i++)
            value = value * 256 + bytes[i];
        if (!Number.isSafeInteger(value))
            throw new StudioError('MUXER_HEADER', 'WebM element size exceeds safe bounds.');
        return { value, size };
    };
    const element = (position) => {
        const id = vint(position, true), size = vint(position + id.size, false);
        return { id: id.value, size: size.value, data: position + id.size + size.size, end: position + id.size + size.size + size.value };
    };
    const ebml = element(0), segment = element(ebml.end);
    if (ebml.id !== 0x1a45dfa3 || segment.id !== 0x18538067)
        throw new StudioError('MUXER_HEADER', 'Unexpected WebM header.');
    for (let position = segment.data; position < segment.end;) {
        const child = element(position);
        if (child.end > segment.end || child.end <= position)
            break;
        if (child.id === 0x1549a966) {
            for (let p = child.data; p < child.end;) {
                const info = element(p);
                if (info.end > child.end || info.end <= p)
                    break;
                if (info.id === 0x4489 && info.size === 8) {
                    const duration = new Uint8Array(8);
                    new DataView(duration.buffer).setFloat64(0, seconds * 1000, false);
                    sink.write(duration, info.data);
                    return;
                }
                p = info.end;
            }
            break;
        }
        position = child.end;
    }
    throw new StudioError('MUXER_HEADER', 'WebM duration field missing; cannot safely finalize this muxer version.');
}
function copyChunk(chunk) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    return data;
}
function configuration(parameters, codec) {
    return { codec, width: parameters.width, height: parameters.height, framerate: parameters.fps, bitrate: parameters.bitrate, bitrateMode: 'variable', latencyMode: 'realtime', alpha: 'discard', hardwareAcceleration: 'no-preference' };
}
export const WEBM_CODECS = ['vp09.00.10.08', 'vp8'];
export const MP4_CODECS = ['avc1.640034', 'avc1.4d0034', 'avc1.420034', 'avc1.64002a', 'avc1.4d002a', 'avc1.42002a', 'avc1.42001f'];
export function createWebMAdapter() {
    return {
        format: 'webm', mimeType: 'video/webm',
        configurations: parameters => WEBM_CODECS.map(codec => configuration(parameters, codec)),
        async createMuxer(parameters, config) {
            const { Muxer, StreamTarget } = await import('webm-muxer');
            const sink = new BoundedSink(parameters.maxOutputBytes);
            let muxer;
            try {
                muxer = new Muxer({ target: new StreamTarget({ onData(data, position) { sink.write(data, position); }, chunked: false }), video: { codec: config.codec.startsWith('vp09') ? 'V_VP9' : 'V_VP8', width: parameters.width, height: parameters.height, frameRate: parameters.fps }, firstTimestampBehavior: 'strict', streaming: false });
            }
            catch (error) {
                sink.dispose();
                throw error;
            }
            return {
                addVideoChunk(chunk, metadata) { if (!muxer)
                    throw new StudioError('MUXER_DISPOSED', 'Muxer disposed.'); muxer.addVideoChunkRaw(copyChunk(chunk), chunk.type, chunk.timestamp, metadata); },
                finalize() { if (!muxer)
                    throw new StudioError('MUXER_DISPOSED', 'Muxer disposed.'); muxer.finalize(); correctWebMDuration(sink, parameters.duration); return sink.blob('video/webm'); },
                dispose() { muxer = undefined; sink.dispose(); },
            };
        },
    };
}
export function createMP4Adapter() {
    return {
        format: 'mp4', mimeType: 'video/mp4',
        configurations: parameters => MP4_CODECS.map(codec => ({ ...configuration(parameters, codec), avc: { format: 'avc' } })),
        async createMuxer(parameters) {
            const { Muxer, StreamTarget } = await import('mp4-muxer');
            const sink = new BoundedSink(parameters.maxOutputBytes);
            let muxer;
            try {
                muxer = new Muxer({ target: new StreamTarget({ onData(data, position) { sink.write(data, position); }, chunked: false }), video: { codec: 'avc', width: parameters.width, height: parameters.height, ...(Number.isInteger(parameters.fps) ? { frameRate: parameters.fps } : {}) }, fastStart: false, firstTimestampBehavior: 'strict' });
            }
            catch (error) {
                sink.dispose();
                throw error;
            }
            return {
                addVideoChunk(chunk, metadata) {
                    if (!muxer)
                        throw new StudioError('MUXER_DISPOSED', 'Muxer disposed.');
                    const index = Math.round(chunk.timestamp * parameters.fps / 1_000_000);
                    const duration = Math.round((index + 1) * 1_000_000 / parameters.fps) - Math.round(index * 1_000_000 / parameters.fps);
                    muxer.addVideoChunkRaw(copyChunk(chunk), chunk.type, chunk.timestamp, duration, metadata);
                },
                finalize() { if (!muxer)
                    throw new StudioError('MUXER_DISPOSED', 'Muxer disposed.'); muxer.finalize(); return sink.blob('video/mp4'); },
                dispose() { muxer = undefined; sink.dispose(); },
            };
        },
    };
}
//# sourceMappingURL=muxers.js.map