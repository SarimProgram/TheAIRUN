import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

const STORAGE_KEY = 'partner.homeWallpaper.v1';
const FOLDER = `${FileSystem.documentDirectory}home-wallpaper/`;

// The app container path changes between installs/updates on iOS, so only the file name is persisted.
let cachedUri: string | null | undefined;
const listeners = new Set<(uri: string | null) => void>();

function emit(uri: string | null) {
  cachedUri = uri;
  listeners.forEach((listener) => listener(uri));
}

export async function getHomeWallpaperUri(): Promise<string | null> {
  if (cachedUri !== undefined) return cachedUri;
  try {
    const fileName = await AsyncStorage.getItem(STORAGE_KEY);
    if (!fileName) {
      cachedUri = null;
      return null;
    }
    const uri = `${FOLDER}${fileName}`;
    const info = await FileSystem.getInfoAsync(uri);
    cachedUri = info.exists ? uri : null;
  } catch {
    cachedUri = null;
  }
  return cachedUri;
}

/** Opens the photo library; resolves to the saved wallpaper uri, or null if the user cancelled. */
export async function pickHomeWallpaper(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.9,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;

  const fileName = `wallpaper-${Date.now()}.jpg`;
  await FileSystem.makeDirectoryAsync(FOLDER, { intermediates: true }).catch(() => {});
  const previous = await FileSystem.readDirectoryAsync(FOLDER).catch(() => [] as string[]);
  await FileSystem.copyAsync({ from: result.assets[0].uri, to: `${FOLDER}${fileName}` });
  await AsyncStorage.setItem(STORAGE_KEY, fileName);
  await Promise.all(
    previous.map((name) => FileSystem.deleteAsync(`${FOLDER}${name}`, { idempotent: true })),
  );

  const uri = `${FOLDER}${fileName}`;
  emit(uri);
  return uri;
}

export function useHomeWallpaper(): string | null {
  const [uri, setUri] = useState<string | null>(cachedUri ?? null);

  useEffect(() => {
    let active = true;
    listeners.add(setUri);
    getHomeWallpaperUri().then((value) => {
      if (active) setUri(value);
    });
    return () => {
      active = false;
      listeners.delete(setUri);
    };
  }, []);

  return uri;
}
