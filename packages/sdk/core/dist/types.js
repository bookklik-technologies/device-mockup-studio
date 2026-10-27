export class StudioError extends Error {
    code;
    cause;
    constructor(code, message, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = 'StudioError';
    }
}
//# sourceMappingURL=types.js.map