// Drive errors and the access scope, shared by drive.js and driveAuth(.web).js.

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const MESSAGES = {
  reconnect: 'Reconnect Google Drive in Settings',
  account: 'Google Drive is connected to a different Google account. Reconnect it in Settings',
  setup: 'Google Drive is not set up for Calq yet',
  full: 'Your Google Drive is full',
  busy: 'Google Drive is busy, try again',
  offline: 'No connection. Check your network',
  'too-large': 'This export is too big to save to Google Drive',
  'not-found': 'That Drive folder no longer exists',
  cancelled: 'Google Drive was not connected',
  failed: 'Google Drive could not save the file',
};

/** Error with a message that can be shown to the user; code is a key of MESSAGES. */
export class DriveError extends Error {
  constructor(code, message = MESSAGES[code]) {
    super(message);
    this.code = code;
  }
}

