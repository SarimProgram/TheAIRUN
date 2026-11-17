import * as FileSystem from 'expo-file-system/legacy';

const root = `${FileSystem.cacheDirectory}workout-photos/`;
let activeScope: string | null = null;
let generation = 0;
let preparation: Promise<void> = Promise.resolve();
const pending = new Map<string, Promise<string>>();
const folder = (scope: string) => `${root}${encodeURIComponent(scope)}/`;

export async function purgeExpiredWorkoutPhotoCache() {
  if (!activeScope) return;
  const directory = folder(activeScope);
  const files = await FileSystem.readDirectoryAsync(directory).catch(() => []);
  await Promise.all(files.filter(file => Number(file.split('_')[0]) <= Date.now())
    .map(file => FileSystem.deleteAsync(`${directory}${file}`, { idempotent: true })));
}

export function activateWorkoutPhotoCache(scope: string) {
  if (activeScope === scope) return preparation;
  activeScope = scope;
  generation++;
  preparation = preparation.catch(() => {}).then(async () => {
    await FileSystem.makeDirectoryAsync(root, { intermediates: true });
    const directories = await FileSystem.readDirectoryAsync(root);
    await Promise.all(directories.filter(name => name !== encodeURIComponent(scope))
      .map(name => FileSystem.deleteAsync(`${root}${name}`, { idempotent: true })));
    await FileSystem.makeDirectoryAsync(folder(scope), { intermediates: true });
    await purgeExpiredWorkoutPhotoCache();
  });
  return preparation;
}

export function clearWorkoutPhotoCache() {
  activeScope = null;
  generation++;
  pending.clear();
  preparation = preparation.catch(() => {}).then(() => FileSystem.deleteAsync(root, { idempotent: true }));
  return preparation;
}

export function cachedWorkoutPhoto(scope: string, id: string, variant: string, expiresAt: string,
  resolve: () => Promise<{ url: string; headers?: Record<string, string> }>) {
  const epoch = generation;
  const expiry = new Date(expiresAt).getTime();
  const key = `${scope}:${id}:${variant}:${epoch}`;
  if (pending.has(key)) return pending.get(key)!;
  const request = (async () => {
    await preparation;
    const valid = () => activeScope === scope && generation === epoch && Number.isFinite(expiry) && expiry > Date.now();
    if (!valid()) throw new Error('Photo expired or access changed');
    const file = `${folder(scope)}${expiry}_${encodeURIComponent(id)}_${encodeURIComponent(variant)}.jpg`;
    if ((await FileSystem.getInfoAsync(file)).exists) {
      if (!valid()) throw new Error('Photo expired or access changed');
      return file;
    }
    const source = await resolve();
    if (!valid()) throw new Error('Photo expired or access changed');
    const partial = `${file}.part`;
    try {
      const result = await FileSystem.downloadAsync(source.url, partial, { headers: source.headers });
      if (result.status !== 200 || !valid()) throw new Error('Photo expired or unavailable');
      await FileSystem.moveAsync({ from: partial, to: file });
      if (!valid()) { await FileSystem.deleteAsync(file, { idempotent: true }); throw new Error('Photo access changed'); }
      return file;
    } catch (error) {
      await FileSystem.deleteAsync(partial, { idempotent: true }).catch(() => {});
      throw error;
    }
  })().finally(() => { pending.delete(key); });
  pending.set(key, request);
  return request;
}
