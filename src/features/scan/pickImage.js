// Camera / photo library -> small JPEG (base64) for the scanEquation function.
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Plenty for handwriting; keeps uploads around 200 KB.
const MAX_SIDE = 1600;

/**
 * @param {'camera'|'library'} source
 * @returns {Promise<{uri: string, base64: string} | null>} null when cancelled
 */
export async function pickImage(source) {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Allow camera access in your phone settings');
  }
  const options = {
    mediaTypes: ['images'],
    // Android's crop tool is free-form; iOS only crops to a square, which cuts long sums.
    allowsEditing: Platform.OS === 'android',
    quality: 1,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled || !res.assets?.length) return null;

  const { uri, width, height } = res.assets[0];
  const ctx = ImageManipulator.manipulate(uri);
  const scale = MAX_SIDE / Math.max(width, height);
  if (scale < 1) ctx.resize({ width: Math.round(width * scale) });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  return { uri: out.uri, base64: out.base64 };
}
