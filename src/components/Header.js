import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  DeviceEventEmitter,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import {launchImageLibrary} from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {ensureDriveScopes} from '../services/driveService';
import {performBackup} from '../services/backupService';
import Svg, {Circle} from 'react-native-svg';

const Header = ({user, onProfileUpdate}) => {
  const [profileVisible, setProfileVisible] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftPhoto, setDraftPhoto] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressTitle, setProgressTitle] = useState('Backup in progress');
  const [progressSubtitle, setProgressSubtitle] = useState('Please wait...');
  const [progressPercent, setProgressPercent] = useState(0);
  const progressStartRef = useRef(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressTimerRef = useRef(null);
  const [anchor, setAnchor] = useState({x: 0, y: 0, width: 40, height: 40});
  const slideAnim = useRef(new Animated.Value(0)).current;
  const avatarRef = useRef(null);
  const {width: screenWidth} = Dimensions.get('window');
  const targetWidth = Math.min(screenWidth - spacing.lg * 2, 360);
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 0],
  });
  const cardTop = Math.max(spacing.md, anchor.y + anchor.height + spacing.xs);
  const maxLeft = Math.max(spacing.md, screenWidth - targetWidth - spacing.md);
  const cardLeft = Math.min(Math.max(spacing.md, anchor.x), maxLeft);

  useEffect(() => {
    if (!profileVisible) {
      return;
    }
    setDraftName(user?.displayName || '');
    setDraftPhoto(user?.photoURL || '');
  }, [profileVisible, user]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'backup:manualStatus',
      status => {
        setBackupRunning(Boolean(status));
      }
    );
    return () => {
      sub.remove();
    };
  }, []);

  const openProfile = () => {
    const animateOpen = () => {
      slideAnim.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };

    if (avatarRef.current?.measureInWindow) {
      avatarRef.current.measureInWindow((x, y, width, height) => {
        setAnchor({x, y, width, height});
        setProfileVisible(true);
        requestAnimationFrame(animateOpen);
      });
      return;
    }

    setProfileVisible(true);
    requestAnimationFrame(animateOpen);
  };

  const closeProfile = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setPhotoPreviewVisible(false);
      setProfileVisible(false);
    });
  };

  const handlePickImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
      });
      if (result.didCancel) {
        return;
      }
      const uri = result.assets?.[0]?.uri;
      if (uri) {
        setDraftPhoto(uri);
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
      Alert.alert('Error', 'Failed to open photo library.');
    }
  };

  const handleSaveProfile = async () => {
    if (!draftName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    setSaving(true);
    try {
      if (onProfileUpdate) {
        const result = await onProfileUpdate({
          displayName: draftName.trim(),
          photoURL: draftPhoto || '',
        });
        if (result?.success === false) {
          Alert.alert('Error', result.message || 'Failed to update profile');
          return;
        }
      }
      closeProfile();
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const openPhotoPreview = () => {
    if (!draftPhoto) {
      return;
    }
    setPhotoPreviewVisible(true);
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

  const handleHeaderBackupPress = async () => {
    if (backupRunning) {
      return;
    }
    try {
      setBackupRunning(true);
      progressStartRef.current = Date.now();
      setProgressTitle('Backup in progress');
      setProgressSubtitle('Please wait...');
      openProgressModal();
      startFakeProgress();
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 100));
      await ensureDriveScopes();
      const firebaseUid = await AsyncStorage.getItem('firebaseUid');
      const email = await AsyncStorage.getItem('backup.accountEmail');
      const include = await AsyncStorage.getItem('backup.includeReceipts');
      await performBackup({
        firebaseUid,
        accountEmail: email,
        includeReceipts: include !== 'false',
      });
      await AsyncStorage.setItem('backup.lastSuccessAt', String(Date.now()));
      setProgressTitle('Backup finished');
      setProgressSubtitle('Backup completed.');
      finishFakeProgress();
      await waitMinVisible();
      closeProgressModal();
    } catch (error) {
      console.error('Manual backup failed:', error);
      setProgressTitle('Backup failed');
      setProgressSubtitle('Unable to backup right now.');
      finishFakeProgress();
      await waitMinVisible();
      closeProgressModal();
    } finally {
      clearProgressTimer();
      setBackupRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={openProfile}
        android_ripple={{color: 'rgba(0,0,0,0.08)'}}
        style={({pressed}) => [styles.leftSection, pressed && styles.leftSectionPressed]}>
        <View ref={avatarRef} collapsable={false}>
          {user?.photoURL ? (
            <Image source={{uri: user.photoURL}} style={styles.userImage} />
          ) : (
            <View style={styles.userIconContainer}>
              <Icon name="person" size={32} color={colors.white} />
            </View>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.displayName || 'User'}
          </Text>
          {!!user?.occupation && (
            <Text style={styles.userSecondaryText} numberOfLines={1}>
              {user.occupation}
            </Text>
          )}
          {!!user?.username && (
            <Text style={styles.userSecondaryText} numberOfLines={1}>
              @{user.username}
            </Text>
          )}
        </View>
      </Pressable>

      <TouchableOpacity
        style={styles.backupButton}
        onPress={handleHeaderBackupPress}>
        <View style={styles.backupIconWrapper}>
          <Feather name="save" size={20} color={colors.text.primary} />
          {backupRunning && (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.backupSpinner}
            />
          )}
        </View>
        <Text style={styles.backupLabel}>Backup</Text>
      </TouchableOpacity>


      <Modal
        visible={profileVisible}
        transparent
        animationType="none"
        onRequestClose={closeProfile}>
        <View style={styles.modalRoot}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeProfile}
            style={styles.modalBackdrop}
          />
          <Animated.View
            style={[
              styles.modalCard,
              {
                top: cardTop,
                left: cardLeft,
                width: targetWidth,
                transform: [{translateY}],
              },
            ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={closeProfile}>
                <Icon name="close" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.photoWrapper}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={openPhotoPreview}>
                {draftPhoto ? (
                  <Image source={{uri: draftPhoto}} style={styles.profileImage} />
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <Icon name="person" size={40} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoEditButton}
                onPress={handlePickImage}>
                <Icon name="pencil" size={16} color={colors.white} />
              </TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.nameInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Enter your name"
              editable={!saving}
            />
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSaveProfile}
              disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={photoPreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPreviewVisible(false)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewBackdrop}
            activeOpacity={1}
            onPress={() => setPhotoPreviewVisible(false)}
          />
          {draftPhoto ? (
            <Image
              source={{uri: draftPhoto}}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setPhotoPreviewVisible(false)}>
            <Icon name="close" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        visible={progressVisible}
        transparent
        animationType="none"
        onRequestClose={() => {}}>
        <View style={styles.progressOverlay}>
          <Animated.View
            style={[
              styles.progressCard,
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
            <Text style={styles.progressTitle}>{progressTitle}</Text>
            <Text style={styles.progressSubtitle}>{progressSubtitle}</Text>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  userIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  userSecondaryText: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  backupButton: {
    padding: spacing.sm,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backupIconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupSpinner: {
    position: 'absolute',
    width: 30,
    height: 30,
  },
  backupLabel: {
    marginLeft: spacing.xs,
    fontSize: fontSize.small,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  modalRoot: {
    flex: 1,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    elevation: 6,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.2,
    shadowRadius: 6,
    position: 'absolute',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  modalClose: {
    padding: 4,
  },
  photoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profilePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEditButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  inputLabel: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSize.regular,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: fontSize.regular,
    fontWeight: fontWeight.semibold,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewClose: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  progressCard: {
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
  progressTitle: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  progressSubtitle: {
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
});

export default Header;
