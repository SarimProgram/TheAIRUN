export function requireStringParam(value: string | string[] | undefined, name: string): string {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Invalid route parameter: ${name}`);
    }
    return value;
}
