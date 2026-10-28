/**
 * Lossless JSON for MPC files
 *
 * MPC project and track files contain numbers that JSON.parse would change:
 * 1.0 becomes 1, 0.32283464074134829 loses its last digit and the pattern
 * length 9223372036854775807 is rounded. This reader keeps every number as
 * its original text and every object as a Map in its original key order, so
 * a file can be changed and written back without touching anything else.
 *
 * The writer produces the layout the MPC uses for .xpj files: one value per
 * line, no indentation (like Python's json.dumps(..., indent=0)).
 */

export class JsonNumber {
    constructor(text) {
        this.text = text;
    }

    /**
     * A number as the MPC writes doubles: always with a decimal point
     */
    static double(value) {
        if (!Number.isFinite(value)) {
            throw new Error(`Invalid number: ${value}`);
        }
        return new JsonNumber(Number.isInteger(value) ? value.toFixed(1) : String(value));
    }

    static integer(value) {
        if (!Number.isInteger(value)) {
            throw new Error(`Not an integer: ${value}`);
        }
        return new JsonNumber(String(value));
    }

    valueOf() {
        return Number(this.text);
    }
}

export function parse(text) {
    let pos = 0;

    const fail = (message) => {
        throw new Error(`JSON parse error at ${pos}: ${message}`);
    };

    const skipWhitespace = () => {
        while (pos < text.length && ' \t\n\r'.includes(text[pos])) {
            pos++;
        }
    };

    const parseString = () => {
        const start = pos;
        pos++; // opening quote
        while (pos < text.length && text[pos] !== '"') {
            pos += text[pos] === '\\' ? 2 : 1;
        }
        if (pos >= text.length) fail('unterminated string');
        pos++; // closing quote
        return JSON.parse(text.slice(start, pos));
    };

    const parseValue = () => {
        skipWhitespace();
        const ch = text[pos];

        if (ch === '{') {
            pos++;
            const map = new Map();
            skipWhitespace();
            if (text[pos] === '}') {
                pos++;
                return map;
            }
            for (;;) {
                skipWhitespace();
                if (text[pos] !== '"') fail('expected key');
                const key = parseString();
                skipWhitespace();
                if (text[pos] !== ':') fail('expected ":"');
                pos++;
                map.set(key, parseValue());
                skipWhitespace();
                if (text[pos] === ',') {
                    pos++;
                } else if (text[pos] === '}') {
                    pos++;
                    return map;
                } else {
                    fail('expected "," or "}"');
                }
            }
        }

        if (ch === '[') {
            pos++;
            const list = [];
            skipWhitespace();
            if (text[pos] === ']') {
                pos++;
                return list;
            }
            for (;;) {
                list.push(parseValue());
                skipWhitespace();
                if (text[pos] === ',') {
                    pos++;
                } else if (text[pos] === ']') {
                    pos++;
                    return list;
                } else {
                    fail('expected "," or "]"');
                }
            }
        }

        if (ch === '"') return parseString();
        if (text.startsWith('true', pos)) { pos += 4; return true; }
        if (text.startsWith('false', pos)) { pos += 5; return false; }
        if (text.startsWith('null', pos)) { pos += 4; return null; }

        const match = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(pos, pos + 64));
        if (!match) fail('unexpected character');
        pos += match[0].length;
        return new JsonNumber(match[0]);
    };

    const value = parseValue();
    skipWhitespace();
    if (pos !== text.length) fail('trailing content');
    return value;
}

export function stringify(value) {
    if (value instanceof JsonNumber) return value.text;
    if (value instanceof Map) {
        if (value.size === 0) return '{}';
        const items = [];
        value.forEach((item, key) => items.push(`${JSON.stringify(key)}: ${stringify(item)}`));
        return `{\n${items.join(',\n')}\n}`;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        return `[\n${value.map(stringify).join(',\n')}\n]`;
    }
    if (typeof value === 'number') {
        throw new Error('Plain numbers are not allowed, use JsonNumber');
    }
    return JSON.stringify(value);
}

/**
 * Deep copy of a parsed value
 */
export function clone(value) {
    if (value instanceof JsonNumber) return new JsonNumber(value.text);
    if (value instanceof Map) return new Map([...value].map(([key, item]) => [key, clone(item)]));
    if (Array.isArray(value)) return value.map(clone);
    return value;
}
