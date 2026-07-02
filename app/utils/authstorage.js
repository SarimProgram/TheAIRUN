import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export async function saveTokens(accessToken, refreshToken) {
  try {
    const pairs = [[ACCESS_TOKEN_KEY, accessToken]];
    if (refreshToken) {
      pairs.push([REFRESH_TOKEN_KEY, refreshToken]);
    }
    await AsyncStorage.multiSet(pairs);
  } catch (e) {
    console.log('Error saving tokens', e);
  }
}

export async function getAccessToken() {
  try {
    const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    return token;
  } catch (e) {
    console.log('Error reading access token', e);
    return null;
  }
}

export async function getRefreshToken() {
  try {
    const token = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    return token;
  } catch (e) {
    console.log('Error reading refresh token', e);
    return null;
  }
}

export async function clearTokens() {
  try {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  } catch (e) {
    console.log('Error clearing tokens', e);
  }
}
