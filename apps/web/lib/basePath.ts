// Mirrors `basePath` in next.config.js. Next prefixes <Link>, router.push
// and file-convention metadata routes itself; use this for everything else.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const withBasePath = (path: string): string => `${BASE_PATH}${path}`;
