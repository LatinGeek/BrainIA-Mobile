export function canonical(value: unknown): string;
export function sha256(value: string): string;
export function fingerprint(value: unknown): string;
export function valid(name: string, value: unknown): boolean;
export function assertContract(name: string, value: unknown): unknown;
export function acceptsReceipt(status: number, envelope: unknown, receipt: unknown): boolean;
