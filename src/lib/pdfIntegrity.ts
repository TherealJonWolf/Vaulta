/**
 * Client-side SHA-256 integrity verification for downloaded PDFs.
 *
 * The server returns the SHA-256 of the PDF bytes via the `X-Content-SHA256`
 * response header. After downloading we recompute the digest on the received
 * bytes and compare. If they don't match the file was altered in transit and
 * we refuse to save it.
 */
export async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = bytes instanceof Uint8Array ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class IntegrityError extends Error {
  constructor(public expected: string, public actual: string) {
    super(`PDF integrity check failed: expected ${expected}, got ${actual}`);
    this.name = "IntegrityError";
  }
}

/**
 * Reads the PDF body from a fetch Response and verifies the SHA-256 hash
 * advertised in the `X-Content-SHA256` header. Returns the verified bytes
 * and the hash so callers can surface it to the user / audit log.
 */
export async function verifyPdfResponse(res: Response): Promise<{ bytes: Uint8Array; sha256: string }> {
  const expected = (res.headers.get("X-Content-SHA256") || "").toLowerCase();
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const actual = await sha256Hex(buf);
  if (!expected) {
    throw new IntegrityError("(missing header)", actual);
  }
  if (expected !== actual) {
    throw new IntegrityError(expected, actual);
  }
  return { bytes, sha256: actual };
}