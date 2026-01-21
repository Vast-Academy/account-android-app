import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import PushNotification from 'react-native-push-notification';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {
  ensureDriveScopes,
  getStorageQuota,
} from '../services/driveService';
import {
  findLatestBackupFile,
  performBackup,
  restoreFromBackup,
} from '../services/backupService';
import RNRestart from 'react-native-restart';
import {
  isAutoBackupEnabled,
  setAutoBackupEnabled,
} from '../utils/backupQueue';
import {listAppDataFiles} from '../services/driveService';
import {notificationService} from '../services/NotificationService';

const formatBytes = value => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = num;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const BackupScreen = ({navigation}) => {
  const [accountEmail, setAccountEmail] = useState('');
  const [quotaText, setQuotaText] = useState('');
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [backupEnabled, setBackupEnabled] = useState(true);
  const [lastBackupAt, setLastBackupAt] = useState('');
  const [includeReceipts, setIncludeReceipts] = useState(true);
  const [uploadMessage, setUploadMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const backupNotificationId = 'backup-progress';

  const loadSettings = async () => {
    const storedEmail = await AsyncStorage.getItem('backup.accountEmail');
    const enabled = await isAutoBackupEnabled();
    const last = await AsyncStorage.getItem('backup.lastSuccessAt');
    const include = await AsyncStorage.getItem('backup.includeReceipts');
    setAccountEmail(storedEmail || '');
    setBackupEnabled(enabled);
    setIncludeReceipts(include !== 'false');
    if (last) {
      const date = new Date(Number(last));
      setLastBackupAt(date.toLocaleString());
    } else {
      setLastBackupAt('');
    }
  };

  const loadQuota = async () => {
    setQuotaLoading(true);
    try {
      await ensureDriveScopes();
      const quota = await getStorageQuota();
      if (quota?.limit) {
        const used = quota.usageInDrive || quota.usage || 0;
        setQuotaText(`${formatBytes(used)} of ${formatBytes(quota.limit)}`);
      } else {
        setQuotaText('');
      }
    } catch (error) {
      console.error('Failed to load storage quota:', error);
      setQuotaText('');
    } finally {
      setQuotaLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (accountEmail) {
      loadQuota();
    }
  }, [accountEmail]);

  const handleChangeAccount = async () => {
    try {
      setBusy(true);
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut();
      const userInfo = await GoogleSignin.signIn();
      const nextEmail = userInfo?.data?.user?.email || userInfo?.user?.email;
      if (nextEmail) {
        setAccountEmail(nextEmail);
        await AsyncStorage.setItem('backup.accountEmail', nextEmail);
        await loadQuota();
      }
    } catch (error) {
      console.error('Failed to change backup account:', error);
      Alert.alert('Error', 'Failed to change backup account');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleBackup = async value => {
    setBackupEnabled(value);
    await setAutoBackupEnabled(value);
  };

  const handleToggleReceipts = async value => {
    setIncludeReceipts(value);
    await AsyncStorage.setItem('backup.includeReceipts', value ? 'true' : 'false');
  };

  const handleBackupNow = async () => {
    try {
      setBusy(true);
      setUploadMessage('Preparing backup...');
      notificationService.requestPermissions();
      PushNotification.localNotification({
        id: backupNotificationId,
        channelId: 'default-channel-id',
        title: 'Backup',
        message: 'Preparing backup...',
        ongoing: true,
        onlyAlertOnce: true,
        autoCancel: false,
      });
      await ensureDriveScopes();
      const firebaseUid = await AsyncStorage.getItem('firebaseUid');
      const email = accountEmail || (await AsyncStorage.getItem('backup.accountEmail'));
      const include = await AsyncStorage.getItem('backup.includeReceipts');
      const handleProgress = (written, total) => {
        const message = total
          ? `Uploading: ${formatBytes(written)} of ${formatBytes(total)}`
          : `Uploading: ${formatBytes(written)}`;
        setUploadMessage(message);
        PushNotification.localNotification({
          id: backupNotificationId,
          channelId: 'default-channel-id',
          title: 'Backup',
          message,
          ongoing: true,
          onlyAlertOnce: true,
          autoCancel: false,
        });
      };
      await performBackup({
        firebaseUid,
        accountEmail: email,
        includeReceipts: include !== 'false',
        onProgress: handleProgress,
      });
      await AsyncStorage.setItem('backup.lastSuccessAt', String(Date.now()));
      await loadSettings();
      setUploadMessage('');
      PushNotification.localNotification({
        id: backupNotificationId,
        channelId: 'default-channel-id',
        title: 'Backup',
        message: 'Backup complete.',
        ongoing: false,
        autoCancel: true,
      });
      Alert.alert('Backup Complete', 'Your data has been backed up.');
    } catch (error) {
      console.error('Manual backup failed:', error);
      setUploadMessage('');
      PushNotification.localNotification({
        id: backupNotificationId,
        channelId: 'default-channel-id',
        title: 'Backup',
        message: 'Backup failed.',
        ongoing: false,
        autoCancel: true,
      });
      Alert.alert('Backup Failed', 'Unable to backup right now.');
    } finally {
      setBusy(false);
    }
  };

  const handleDebugInfo = async () => {
    try {
      setBusy(true);
      console.log('🐛 [DEBUG] ===== Debug Info =====');

      await ensureDriveScopes();

      const firebaseUid = await AsyncStorage.getItem('firebaseUid');
      const backupFileId = await AsyncStorage.getItem('backup.fileId');
      const backupEmail = await AsyncStorage.getItem('backup.accountEmail');
      const lastBackup = await AsyncStorage.getItem('backup.lastSuccessAt');

      console.log('🐛 [DEBUG] FirebaseUid:', firebaseUid);
      console.log('🐛 [DEBUG] Backup FileId:', backupFileId);
      console.log('🐛 [DEBUG] Backup Email:', backupEmail);
      console.log('🐛 [DEBUG] Last Backup:', lastBackup);

      const files = await listAppDataFiles();

      console.log('🐛 [DEBUG] ===== End Debug Info =====');

      const fileNames = files.map(f => `${f.name} (${f.size} bytes)`).join('\n');
      Alert.alert(
        'Debug Info',
        `FirebaseUid: ${firebaseUid}\n\nBackup FileId: ${backupFileId}\n\nFiles in Drive (${files.length}):\n${fileNames || 'None'}`,
        [{text: 'OK'}]
      );
    } catch (error) {
      console.error('🐛 [DEBUG] Error:', error);
      Alert.alert('Debug Error', error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreNow = async () => {
    try {
      setBusy(true);
      await ensureDriveScopes();
      const firebaseUid = await AsyncStorage.getItem('firebaseUid');
      const latest = await findLatestBackupFile(firebaseUid);
      if (!latest) {
        Alert.alert('No Backup Found', 'No backup available in Drive.');
        return;
      }
      Alert.alert(
        'Restore Backup',
        'This will replace your current local data.',
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                await restoreFromBackup({fileId: latest.id});
                Alert.alert('Restore Complete', 'Backup restored successfully.', [
                  {
                    text: 'OK',
                    onPress: () => RNRestart.Restart(),
                  },
                ]);
              } catch (restoreError) {
                console.error('Restore failed:', restoreError);
                Alert.alert('Restore Failed', 'Unable to restore backup.');
              }
            },
          },
        ],
      );
    } catch (error) {
      console.error('Restore flow failed:', error);
      Alert.alert('Restore Failed', 'Unable to restore backup.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Backup & Restore</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backup Account</Text>
        <View style={styles.emailDisplay}>
          <Text style={styles.emailText}>{accountEmail || 'Not selected'}</Text>
        </View>
        <Text style={styles.subText}>
          Using your sign-in email for backup
        </Text>
        <Text style={styles.storageText}>
          {quotaLoading ? 'Loading storage...' : quotaText || 'Storage unavailable'}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>Auto Backup</Text>
          <Switch value={backupEnabled} onValueChange={handleToggleBackup} />
        </View>
        <Text style={styles.subText}>Backups happen automatically on data changes.</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.sectionTitle}>Receipt Photos</Text>
          <Switch value={includeReceipts} onValueChange={handleToggleReceipts} />
        </View>
        <Text style={styles.subText}>Include receipt photos in backup.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last Backup</Text>
        <Text style={styles.subText}>{lastBackupAt || 'No backups yet'}</Text>
      </View>

      <View style={styles.actions}>
        {uploadMessage ? (
          <Text style={styles.progressText}>{uploadMessage}</Text>
        ) : null}
        <TouchableOpacity style={styles.primaryButton} onPress={handleBackupNow} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Back up now</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleRestoreNow} disabled={busy}>
          <Text style={styles.secondaryText}>Restore latest backup</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.debugButton} onPress={handleDebugInfo} disabled={busy}>
          <Text style={styles.debugText}>Show Debug Info</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 6,
  },
  backText: {
    fontSize: fontSize.small,
    color: colors.text.primary,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  section: {
    backgroundColor: colors.white,
    marginTop: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  emailDisplay: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emailText: {
    fontSize: fontSize.regular,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  storageText: {
    marginTop: spacing.xs,
    fontSize: fontSize.small,
    color: colors.text.secondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  rowText: {
    fontSize: fontSize.regular,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  linkButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  linkText: {
    fontSize: fontSize.small,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  subText: {
    marginTop: spacing.xs,
    fontSize: fontSize.small,
    color: colors.text.secondary,
  },
  actions: {
    padding: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryText: {
    color: colors.white,
    fontWeight: fontWeight.semibold,
  },
  secondaryButton: {
    marginTop: spacing.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.text.primary,
    fontWeight: fontWeight.semibold,
  },
  progressText: {
    marginBottom: spacing.sm,
    fontSize: fontSize.small,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  debugButton: {
    marginTop: spacing.sm,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  debugText: {
    color: '#666',
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.small,
  },
});

export default BackupScreen;
