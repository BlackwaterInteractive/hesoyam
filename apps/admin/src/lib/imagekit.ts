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

export type AssetSlot = 'icon' | 'logo' | 'hero' | 'grid';

export function gameAssetFolder(gameId: string): string {
  return `/games/${gameId}`;
}

export function gameAssetFileName(slot: AssetSlot): string {
  return `${slot}.jpg`;
}

export async function uploadFromUrl(input: {
  gameId: string;
  slot: AssetSlot;
  sourceUrl: string;
}): Promise<{ url: string; fileId: string }> {
  const result = await getClient().upload({
    file: input.sourceUrl,
    fileName: gameAssetFileName(input.slot),
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
