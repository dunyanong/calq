// Firebase Auth options on Android and iOS: remember the signed-in user in AsyncStorage.
// The web build uses authOptions.web.js instead.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReactNativePersistence } from 'firebase/auth';

export const authOptions = { persistence: getReactNativePersistence(AsyncStorage) };
