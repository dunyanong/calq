// Native alert dialog (title, message, buttons). The web build uses showAlert.web.js,
// because react-native-web's Alert.alert does nothing.
import { Alert } from 'react-native';

/** @param {{text: string, style?: 'cancel'|'destructive'|'default', onPress?: () => void}[]} [buttons] */
export function showAlert(title, message, buttons) {
  Alert.alert(title, message, buttons);
}
