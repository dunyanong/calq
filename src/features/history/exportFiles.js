// Writing and sharing export files on Android and iOS (cache folder + share sheet).
// The web build uses exportFiles.web.js instead.
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Writes fileName to the cache and returns the File.
 * @param {{html?: Function}} f  the format (exportHistory FORMATS); html: content is a page printed to PDF
 */
export async function writeFile(fileName, f, content) {
  const file = new File(Paths.cache, fileName);
  if (f.html) {
    // expo-print saves under a random name; move it so the shared file is <name>.pdf
    const { uri } = await Print.printToFileAsync({ html: content });
    if (file.exists) file.delete();
    new File(uri).move(file);
  } else {
    file.create({ overwrite: true });
    file.write(content);
  }
  return file;
}

/** Opens the share sheet for a written file. Resolves when it closes. */
export async function share(file, f) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, { mimeType: f.mimeType, UTI: f.UTI, dialogTitle: 'Export calculations' });
}
