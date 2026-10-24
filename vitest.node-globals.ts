import { Blob, File } from 'node:buffer';

/**
 * Runs before src/test/setup.ts. jsdom brings its own FormData/File/Blob, which Node's fetch can't
 * send (uploads fail with "Premature close"). Tests use Node's classes instead, as a browser's fetch
 * gets its own.
 */
// Node's FormData isn't importable; reach it through an empty local body (the deprecation is about
// parsing untrusted server responses).
// eslint-disable-next-line @typescript-eslint/no-deprecated
const NodeFormData = (await new Response(new URLSearchParams()).formData()).constructor;

for (const [name, value] of Object.entries({ Blob, File, FormData: NodeFormData }))
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
