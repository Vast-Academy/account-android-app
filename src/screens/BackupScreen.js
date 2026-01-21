import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
  Animated,
  Easing,
  DeviceEventEmitter,
} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
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
  const [busy, setBusy] = useState(false);
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressTitle, setProgressTitle] = useState('Backup in progress');
  const [progressSubtitle, setProgressSubtitle] = useState('Please wait...');
  const [progressPercent, setProgressPercent] = useState(0);
  const progressStartRef = useRef(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressTimerRef = useRef(null);

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

  const openProgressModal = () => {
    setProgressVisible(true);
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeProgressModal = () => {
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setProgressVisible(false);
    });
  };

  const waitMinVisible = async (minMs = 1200) => {
    const elapsed = Date.now() - progressStartRef.current;
    const remaining = Math.max(0, minMs - elapsed);
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining));
    }
  };

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const startFakeProgress = () => {
    clearProgressTimer();
    setProgressPercent(0);
    let current = 0;
    progressTimerRef.current = setInterval(() => {
      if (current < 90) {
        current += 2;
      } else if (current < 98) {
        current += 0.4;
      } else {
        current += 0.1;
      }
      if (current > 99.2) {
        current = 99.2;
      }
      setProgressPercent(current);
    }, 80);
  };

  const finishFakeProgress = () => {
    clearProgressTimer();
    setProgressPercent(100);
  };

  const handleBackupNow = async () => {
    try {
      setBusy(true);
      progressStartRef.current = Date.now();
      setProgressTitle('Backup in progress');
      setProgressSubtitle('Please wait...');
      openProgressModal();
      startFakeProgress();
      DeviceEventEmitter.emit('backup:manualStatus', true);
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 100));
      await ensureDriveScopes();
      const firebaseUid = await AsyncStorage.getItem('firebaseUid');
      const email = accountEmail || (await AsyncStorage.getItem('backup.accountEmail'));
      const include = await AsyncStorage.getItem('backup.includeReceipts');
      await performBackup({
        firebaseUid,
        accountEmail: email,
        includeReceipts: include !== 'false',
      });
      await AsyncStorage.setItem('backup.lastSuccessAt', String(Date.now()));
      await loadSettings();
      setProgressTitle('Backup finished');
      setProgressSubtitle('Backup completed.');
      finishFakeProgress();
      await waitMinVisible();
      closeProgressModal();
      Alert.alert('Backup Complete', 'Your data has been backed up.');
    } catch (error) {
      console.error('Manual backup failed:', error);
      setProgressTitle('Backup failed');
      setProgressSubtitle('Unable to backup right now.');
      finishFakeProgress();
      await waitMinVisible();
      closeProgressModal();
      Alert.alert('Backup Failed', 'Unable to backup right now.');
    } finally {
      clearProgressTimer();
      DeviceEventEmitter.emit('backup:manualStatus', false);
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

      <Modal
        visible={progressVisible}
        transparent
        animationType="none"
        onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalCard,
              {
                opacity: progressAnim,
                transform: [
                  {
                    translateY: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.progressRing}>
              <Svg width={72} height={72}>
                <Circle
                  cx={36}
                  cy={36}
                  r={30}
                  stroke="#E5E7EB"
                  strokeWidth={6}
                  fill="none"
                />
                <Circle
                  cx={36}
                  cy={36}
                  r={30}
                  stroke={colors.primary}
                  strokeWidth={6}
                  fill="none"
                  strokeDasharray={2 * Math.PI * 30}
                  strokeDashoffset={
                    (2 * Math.PI * 30 * (100 - progressPercent)) / 100
                  }
                  strokeLinecap="round"
                  rotation="-90"
                  origin="36, 36"
                />
              </Svg>
              <Text style={styles.progressPercent}>
                {Math.round(progressPercent)}%
              </Text>
            </View>
            <Text style={styles.modalTitle}>{progressTitle}</Text>
            <Text style={styles.modalSubtitle}>{progressSubtitle}</Text>
          </Animated.View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: spacing.md,
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  progressRing: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressPercent: {
    position: 'absolute',
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
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
