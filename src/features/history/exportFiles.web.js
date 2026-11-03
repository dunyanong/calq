// Web: an export is a download, and a PDF opens the browser's print dialog
// (Save as PDF). Same shape as the File that exportFiles.js returns, for Drive uploads.

/** UTF-8 text as base64. */
const textBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/**
 * The export as an in-memory file: { name, size, base64(), blob } or, for a PDF,
 * { name, size, printHtml } (the page to print; Drive turns it into a PDF).
 */
export async function writeFile(fileName, f, content) {
  const size = new TextEncoder().encode(content).length;
  if (f.html) return { name: fileName, size, printHtml: { html: content, base64: textBase64(content) } };
  const blob = new Blob([content], { type: f.mimeType + ';charset=utf-8' });
  return { name: fileName, size, blob, base64: async () => textBase64(content) };
}

/** Prints the page from a hidden frame: popup blockers leave it alone. */
function print(html) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, { position: 'fixed', width: '0', height: '0', border: '0', right: '0', bottom: '0' });
    frame.onload = () => {
      const win = frame.contentWindow;
      const done = () => {
        setTimeout(() => frame.remove(), 1000);
        resolve();
      };
      win.addEventListener('afterprint', done, { once: true });
      win.focus();
      win.print();
      setTimeout(done, 60_000); // some browsers never fire afterprint
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

function download(file) {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Downloads the file, or opens the print dialog for a PDF. */
export async function share(file) {
  if (file.printHtml) await print(file.printHtml.html);
  else download(file);
}
