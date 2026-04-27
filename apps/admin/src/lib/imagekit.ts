import ImageKit from 'imagekit';

let client: ImageKit | null = null;

function getClient(): ImageKit {
  if (client) return client;

  const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error(
      'ImageKit env vars missing. Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT in apps/admin/.env.local.',
    );
  }

  client = new ImageKit({ publicKey, privateKey, urlEndpoint });
  return client;
}

export type AssetSlot = 'grid' | 'icon' | 'hero' | 'logo';

export function gameAssetFolder(gameId: string): string {
  return `/games/${gameId}`;
}

export function gameAssetFileName(slot: AssetSlot, ext: string = 'jpg'): string {
  return `${slot}.${ext}`;
}

// Derive the file extension to save under, based on the source URL's path.
// Matters for animation: ImageKit treats the fileName extension as a hint and
// will process / serve the file accordingly. Uploading a GIF as `.jpg` strips
// the animation. Always use the original extension instead.
export function extensionFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').pop() ?? '';
    const dot = last.lastIndexOf('.');
    if (dot === -1) return null;
    const ext = last.slice(dot + 1).toLowerCase();
    // Whitelist what we accept — anything else falls through to the caller's default.
    if (['gif', 'webp', 'png', 'jpg', 'jpeg'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
    return null;
  } catch {
    return null;
  }
}

export function extensionFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m === 'image/gif') return 'gif';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/png') return 'png';
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  return 'jpg';
}

export function fileNameFromUrl(url: string): string | null {
  try {
    return new URL(url).pathname.split('/').pop() || null;
  } catch {
    return null;
  }
}

export async function uploadFromUrl(input: {
  gameId: string;
  slot: AssetSlot;
  sourceUrl: string;
}): Promise<{ url: string; fileId: string }> {
  const ext = extensionFromUrl(input.sourceUrl) ?? 'jpg';
  const result = await getClient().upload({
    file: input.sourceUrl,
    fileName: gameAssetFileName(input.slot, ext),
    folder: gameAssetFolder(input.gameId),
    useUniqueFileName: false,
    overwriteFile: true,
  });
  return { url: result.url, fileId: result.fileId };
}

export function getClientUploadAuth(): {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
} {
  const auth = getClient().getAuthenticationParameters();
  return { ...auth, publicKey: process.env.IMAGEKIT_PUBLIC_KEY! };
}

export async function deleteGameFolder(gameId: string): Promise<void> {
  try {
    await getClient().deleteFolder(gameAssetFolder(gameId));
  } catch (err) {
    console.warn(`[imagekit] deleteFolder /games/${gameId} failed:`, err);
  }
}

// Best-effort deletion of specific files within a game's folder. Used by
// re-enrichment to clean up:
// - files for slots being dropped entirely (was set, now null)
// - files for slots being re-uploaded with a different extension (e.g. PNG → GIF)
// Caller passes the exact filenames to delete (e.g. "grid.png", "logo.gif").
// One listFiles + one bulkDeleteFiles call regardless of how many.
export async function deleteFilesByName(
  gameId: string,
  fileNames: string[],
): Promise<void> {
  if (fileNames.length === 0) return;
  try {
    const folder = gameAssetFolder(gameId);
    const wanted = new Set(fileNames);
    const files = (await getClient().listFiles({
      path: folder,
      limit: 100,
    })) as Array<{ name: string; fileId: string }>;
    const fileIds = files
      .filter((f) => wanted.has(f.name))
      .map((f) => f.fileId);
    if (fileIds.length > 0) {
      await getClient().bulkDeleteFiles(fileIds);
    }
  } catch (err) {
    console.warn(
      `[imagekit] deleteFilesByName /games/${gameId} (${fileNames.join(',')}) failed:`,
      err,
    );
  }
}
