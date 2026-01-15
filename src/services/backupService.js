import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import {zip, unzip} from 'react-native-zip-archive';
import {open} from 'react-native-quick-sqlite';
import {
  deleteAppDataFile,
  downloadAppDataFile,
  listAppDataFiles,
  uploadAppDataFile,
} from './driveService';

const DB_FILE_BASES = ['accountsDB.db', 'ledgerDB.db', 'accountApp.db'];
const BACKUP_DIR = `${RNFS.CachesDirectoryPath}/backup_tmp`;
const ARCHIVE_NAME_PREFIX = 'backup_';
const BACKUP_META_KEY = 'backup.meta';

const EXCLUDED_ASYNC_KEYS = new Set([
  'firebaseToken',
  'backup.fileId',
  'backup.lastSuccessAt',
  'backup.accountEmail',
  'backup.enabled',
  BACKUP_META_KEY,
]);

const safeUnlink = async path => {
  try {
    const exists = await RNFS.exists(path);
    if (exists) {
      await RNFS.unlink(path);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
};

const ensureDir = async path => {
  const exists = await RNFS.exists(path);
  if (!exists) {
    await RNFS.mkdir(path);
  }
};

const getDbPath = dbName => `${RNFS.DocumentDirectoryPath}/${dbName}`;

const getDbPathFromPragma = dbName => {
  try {
    const db = open({name: dbName});
    const result = db.execute('PRAGMA database_list');
    const rows = result.rows?._array || [];
    const mainRow = rows.find(row => row.name === 'main');
    if (mainRow?.file) {
      return mainRow.file;
    }
  } catch (error) {
    console.warn(`Backup path lookup failed for ${dbName}:`, error);
  }
  return null;
};

const checkpointDatabase = dbName => {
  try {
    const db = open({name: dbName});
    db.execute('PRAGMA wal_checkpoint(FULL);');
  } catch (error) {
    console.warn(`Backup checkpoint skipped for ${dbName}:`, error);
  }
};

const logFileSize = async label => {
  try {
    const stats = await RNFS.stat(label);
    console.log('Backup file size:', label, stats.size);
  } catch (error) {
    // Ignore stat errors
  }
};

const locateDbPath = async dbName => {
  const pragmaPath = getDbPathFromPragma(dbName);
  if (pragmaPath && (await RNFS.exists(pragmaPath))) {
    return pragmaPath;
  }
  const primary = getDbPath(dbName);
  if (await RNFS.exists(primary)) {
    return primary;
  }
  const fallback = `${RNFS.LibraryDirectoryPath}/${dbName}`;
  if (await RNFS.exists(fallback)) {
    return fallback;
  }
  return primary;
};

const locateRestoreTarget = async dbName => {
  const pragmaPath = getDbPathFromPragma(dbName);
  if (pragmaPath) {
    return pragmaPath;
  }
  return getDbPath(dbName);
};

const collectAsyncStorageSnapshot = async () => {
  const keys = await AsyncStorage.getAllKeys();
  const filtered = keys.filter(key => !EXCLUDED_ASYNC_KEYS.has(key));
  if (filtered.length === 0) {
    return {};
  }
  const entries = await AsyncStorage.multiGet(filtered);
  return entries.reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
};

const writeSnapshotFiles = async ({firebaseUid}) => {
  await safeUnlink(BACKUP_DIR);
  await ensureDir(BACKUP_DIR);

  const dataDir = `${BACKUP_DIR}/data`;
  await ensureDir(dataDir);

  const dbFiles = [];
  for (const dbName of DB_FILE_BASES) {
    checkpointDatabase(dbName);
    const source = await locateDbPath(dbName);
    console.log('📦 [BACKUP] Checking DB:', dbName);
    console.log('📦 [BACKUP] Source path:', source);

    const sourceExists = await RNFS.exists(source);
    console.log('📦 [BACKUP] File exists?', sourceExists);

    const target = `${dataDir}/${dbName}`;
    if (sourceExists) {
      await RNFS.copyFile(source, target);
      dbFiles.push(dbName);
      console.log('✅ [BACKUP] Copied successfully:', dbName);
      await logFileSize(target);
    } else {
      console.log('❌ [BACKUP] File not found, skipping:', dbName);
    }
    const walName = `${dbName}-wal`;
    const shmName = `${dbName}-shm`;
    const walSource = await locateDbPath(walName);
    const shmSource = await locateDbPath(shmName);
    if (await RNFS.exists(walSource)) {
      await RNFS.copyFile(walSource, `${dataDir}/${walName}`);
      dbFiles.push(walName);
      await logFileSize(`${dataDir}/${walName}`);
    }
    if (await RNFS.exists(shmSource)) {
      await RNFS.copyFile(shmSource, `${dataDir}/${shmName}`);
      dbFiles.push(shmName);
      await logFileSize(`${dataDir}/${shmName}`);
    }
  }

  const asyncData = await collectAsyncStorageSnapshot();
  await RNFS.writeFile(
    `${dataDir}/asyncStorage.json`,
    JSON.stringify(asyncData),
    'utf8',
  );

  const manifest = {
    backupVersion: 1,
    createdAt: Date.now(),
    firebaseUid: firebaseUid || null,
    dbFiles,
  };

  console.log('📦 [BACKUP] Total files added to backup:', dbFiles.length);
  console.log('📦 [BACKUP] Files list:', dbFiles);

  await RNFS.writeFile(
    `${dataDir}/manifest.json`,
    JSON.stringify(manifest),
    'utf8',
  );

  return {dataDir, manifest};
};

export const createBackupArchive = async ({firebaseUid}) => {
  const {dataDir, manifest} = await writeSnapshotFiles({firebaseUid});
  const archiveName = `${ARCHIVE_NAME_PREFIX}${firebaseUid || 'unknown'}.zip`;
  const archivePath = `${BACKUP_DIR}/${archiveName}`;
  await safeUnlink(archivePath);
  await zip(dataDir, archivePath);
  await logFileSize(archivePath);
  return {archivePath, archiveName, manifest};
};

export const performBackup = async ({firebaseUid, accountEmail}) => {
  console.log('📦 [BACKUP] ===== Starting Backup =====');
  console.log('📦 [BACKUP] firebaseUid:', firebaseUid);
  console.log('📦 [BACKUP] accountEmail:', accountEmail);

  const {archivePath, archiveName, manifest} = await createBackupArchive({
    firebaseUid,
  });

  console.log('📦 [BACKUP] Archive created:', archiveName);
  console.log('📦 [BACKUP] Archive path:', archivePath);

  const fileId = await AsyncStorage.getItem('backup.fileId');
  console.log('📦 [BACKUP] Existing fileId in storage:', fileId);

  const uploadResult = await uploadAppDataFile({
    filePath: archivePath,
    fileName: archiveName,
    existingFileId: fileId || null,
  });

  console.log('✅ [BACKUP] Upload successful! Result:', uploadResult);

  await AsyncStorage.setItem('backup.fileId', uploadResult.id || '');
  await AsyncStorage.setItem('backup.lastSuccessAt', String(Date.now()));
  if (accountEmail) {
    await AsyncStorage.setItem('backup.accountEmail', accountEmail);
  }
  await AsyncStorage.setItem(BACKUP_META_KEY, JSON.stringify(manifest));

  console.log('📦 [BACKUP] ===== Backup Complete =====');
  return uploadResult;
};

export const findLatestBackupFile = async firebaseUid => {
  console.log('🔍 [BACKUP] ===== Searching for Backup =====');
  console.log('🔍 [BACKUP] firebaseUid:', firebaseUid);
  console.log('🔍 [BACKUP] Expected filename:', `${ARCHIVE_NAME_PREFIX}${firebaseUid}.zip`);

  const files = await listAppDataFiles();
  console.log('🔍 [BACKUP] Total files in Drive:', files.length);
  console.log('🔍 [BACKUP] All files:', JSON.stringify(files, null, 2));

  const filtered = files.filter(file => {
    if (!file?.name) {
      console.log('🔍 [BACKUP] Skipping file (no name):', file);
      return false;
    }
    if (!file.name.startsWith(ARCHIVE_NAME_PREFIX)) {
      console.log('🔍 [BACKUP] Skipping file (wrong prefix):', file.name);
      return false;
    }
    if (firebaseUid) {
      const expectedName = `${ARCHIVE_NAME_PREFIX}${firebaseUid}.zip`;
      const match = file.name === expectedName;
      console.log(`🔍 [BACKUP] Comparing "${file.name}" === "${expectedName}": ${match}`);
      return match;
    }
    return true;
  });

  console.log('🔍 [BACKUP] Filtered files count:', filtered.length);
  console.log('🔍 [BACKUP] Filtered files:', JSON.stringify(filtered, null, 2));

  const candidates = filtered.length > 0 ? filtered : files;
  if (candidates.length === 0) {
    console.log('❌ [BACKUP] No backup file found!');
    return null;
  }

  const latest = candidates
    .slice()
    .sort(
      (a, b) =>
        new Date(b.modifiedTime).getTime() -
        new Date(a.modifiedTime).getTime(),
    )[0];

  console.log('✅ [BACKUP] Latest backup selected:', JSON.stringify(latest, null, 2));
  console.log('🔍 [BACKUP] ===== Search Complete =====');
  return latest;
};

export const restoreFromBackup = async ({fileId}) => {
  console.log('🔄 [RESTORE] ===== Starting Restore =====');
  console.log('🔄 [RESTORE] fileId:', fileId);

  await safeUnlink(BACKUP_DIR);
  await ensureDir(BACKUP_DIR);

  const archivePath = `${BACKUP_DIR}/restore.zip`;
  console.log('🔄 [RESTORE] Downloading to:', archivePath);

  try {
    await downloadAppDataFile(fileId, archivePath);
    console.log('✅ [RESTORE] Download successful');
  } catch (error) {
    console.error('❌ [RESTORE] Download failed:', error);
    console.error('❌ [RESTORE] Error details:', error.message);
    throw error;
  }

  const restoreDir = `${BACKUP_DIR}/restore`;
  await safeUnlink(restoreDir);
  await ensureDir(restoreDir);

  console.log('🔄 [RESTORE] Unzipping archive...');
  try {
    await unzip(archivePath, restoreDir);
    console.log('✅ [RESTORE] Unzip successful');
  } catch (error) {
    console.error('❌ [RESTORE] Unzip failed:', error);
    throw error;
  }

  // Debug: List all files in restore directory
  console.log('🔍 [RESTORE] Checking extracted contents...');
  const restoreDirContents = await RNFS.readDir(restoreDir);
  console.log('🔍 [RESTORE] Root files/folders:', restoreDirContents.map(f => f.name));

  // Check if files are in 'data' subfolder or directly in root
  let dataDir = `${restoreDir}/data`;
  const dataDirExists = await RNFS.exists(dataDir);

  if (!dataDirExists) {
    console.log('🔍 [RESTORE] Data folder not found, using root directory');
    dataDir = restoreDir;  // Use root directory instead
  }

  console.log('🔄 [RESTORE] Using directory:', dataDir);
  const finalContents = await RNFS.readDir(dataDir);
  console.log('🔍 [RESTORE] Files to restore:', finalContents.map(f => f.name));

  for (const dbName of DB_FILE_BASES) {
    const source = `${dataDir}/${dbName}`;
    const target = await locateRestoreTarget(dbName);
    console.log(`🔄 [RESTORE] Restoring ${dbName} from ${source} to ${target}`);
    if (await RNFS.exists(source)) {
      await RNFS.copyFile(source, target);
      console.log(`✅ [RESTORE] ${dbName} restored successfully`);
    } else {
      console.log(`⚠️ [RESTORE] ${dbName} not found in backup`);
    }
    const walName = `${dbName}-wal`;
    const shmName = `${dbName}-shm`;
    const walSource = `${dataDir}/${walName}`;
    const shmSource = `${dataDir}/${shmName}`;
    if (await RNFS.exists(walSource)) {
      await RNFS.copyFile(walSource, await locateRestoreTarget(walName));
    } else {
      await safeUnlink(await locateRestoreTarget(walName));
    }
    if (await RNFS.exists(shmSource)) {
      await RNFS.copyFile(shmSource, await locateRestoreTarget(shmName));
    } else {
      await safeUnlink(await locateRestoreTarget(shmName));
    }
  }

  const asyncPath = `${dataDir}/asyncStorage.json`;
  if (await RNFS.exists(asyncPath)) {
    const raw = await RNFS.readFile(asyncPath, 'utf8');
    const payload = JSON.parse(raw || '{}');
    const preservedKeys = [
      'firebaseToken',
      'backup.accountEmail',
      'backup.enabled',
    ];
    const preserved = await AsyncStorage.multiGet(preservedKeys);
    await AsyncStorage.clear();
    const entries = Object.entries(payload).map(([key, value]) => [
      key,
      value,
    ]);
    if (entries.length > 0) {
      await AsyncStorage.multiSet(entries);
    }
    const preservedEntries = preserved.filter(([, value]) => value != null);
    if (preservedEntries.length > 0) {
      await AsyncStorage.multiSet(preservedEntries);
    }
  }

  if (fileId) {
    await AsyncStorage.setItem('backup.fileId', String(fileId));
  }

  console.log('✅ [RESTORE] ===== Restore Complete =====');
  return true;
};

export const deleteBackup = async fileId => {
  await deleteAppDataFile(fileId);
  await AsyncStorage.removeItem('backup.fileId');
  return true;
};
