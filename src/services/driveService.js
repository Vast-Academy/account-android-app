import {GoogleSignin} from '@react-native-google-signin/google-signin';
import RNFS from 'react-native-fs';

const DRIVE_BASE_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

const getAccessToken = async () => {
  const tokens = await GoogleSignin.getTokens();
  return tokens?.accessToken || null;
};

export const ensureDriveScopes = async () => {
  const hasPrevious = await GoogleSignin.hasPreviousSignIn();
  if (!hasPrevious) {
    await GoogleSignin.signIn();
  } else {
    try {
      await GoogleSignin.signInSilently();
    } catch (error) {
      await GoogleSignin.signIn();
    }
  }
  await GoogleSignin.addScopes({scopes: DRIVE_SCOPES});
  return GoogleSignin.signInSilently();
};

const driveFetch = async (url, options = {}) => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Missing Google access token');
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };
  const response = await fetch(url, {...options, headers});
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Drive API error: ${response.status} ${text}`);
  }
  return response;
};

export const getStorageQuota = async () => {
  const url = `${DRIVE_BASE_URL}/about?fields=storageQuota`;
  const response = await driveFetch(url);
  const data = await response.json();
  return data.storageQuota || null;
};

export const listAppDataFiles = async (nameFilter = null) => {
  console.log('📁 [DRIVE] Listing files from appDataFolder...');
  console.log('📁 [DRIVE] nameFilter:', nameFilter);

  const q = nameFilter ? `name='${nameFilter.replace(/'/g, "\\'")}'` : null;
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name,modifiedTime,size)',
  });
  if (q) {
    params.set('q', q);
  }
  const url = `${DRIVE_BASE_URL}/files?${params.toString()}`;
  console.log('📁 [DRIVE] Request URL:', url);

  const response = await driveFetch(url);
  const data = await response.json();

  console.log('📁 [DRIVE] Files found:', data.files?.length || 0);
  console.log('📁 [DRIVE] Files:', JSON.stringify(data.files, null, 2));

  return data.files || [];
};

export const uploadAppDataFile = async ({
  filePath,
  fileName,
  mimeType = 'application/zip',
  existingFileId = null,
}) => {
  const boundary = `backup_${Date.now()}`;
  const fileBase64 = await RNFS.readFile(filePath, 'base64');
  const metadata = {
    name: fileName,
    mimeType,
  };

  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    `${fileBase64}\r\n` +
    `--${boundary}--`;

  if (existingFileId) {
    const updateUrl = `${DRIVE_UPLOAD_URL}/${existingFileId}?uploadType=multipart`;
    const response = await driveFetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    return response.json();
  }

  const createUrl = `${DRIVE_UPLOAD_URL}?uploadType=multipart`;
  const response = await driveFetch(createUrl, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  return response.json();
};

export const downloadAppDataFile = async (fileId, destinationPath) => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Missing Google access token');
  }
  const fromUrl = `${DRIVE_BASE_URL}/files/${fileId}?alt=media`;
  const result = await RNFS.downloadFile({
    fromUrl,
    toFile: destinationPath,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).promise;

  if (result.statusCode !== 200) {
    throw new Error(`Drive download failed: ${result.statusCode}`);
  }
  return destinationPath;
};

export const deleteAppDataFile = async fileId => {
  const url = `${DRIVE_BASE_URL}/files/${fileId}`;
  await driveFetch(url, {method: 'DELETE'});
  return true;
};
