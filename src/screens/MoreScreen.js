import React from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  View,
  Text,
  Image,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  BackHandler,
  TextInput,
  NativeModules,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import ImagePicker from 'react-native-image-crop-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {auth} from '../config/firebase';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {clearLocalData} from '../services/database';
import {clearAllAccountsData} from '../services/accountsDatabase';
import {clearAllLedgerData} from '../services/ledgerDatabase';
import {queueBackupFromStorage} from '../utils/backupQueue';
import {updateProfile} from '../services/api';

const OCCUPATION_OPTIONS = [
  {label: 'Business Owner', value: 'Business Owner'},
  {label: 'Cab / Auto Driver', value: 'Cab / Auto Driver'},
  {label: 'Carpenter', value: 'Carpenter'},
  {label: 'Chartered Accountant', value: 'Chartered Accountant'},
  {label: 'Chef', value: 'Chef'},
  {label: 'Civil Engineer', value: 'Civil Engineer'},
  {label: 'Cleaner', value: 'Cleaner'},
  {label: 'Clerk', value: 'Clerk'},
  {label: 'Consultant', value: 'Consultant'},
  {label: 'Content Creator', value: 'Content Creator'},
  {label: 'Contractor', value: 'Contractor'},
  {label: 'Cook', value: 'Cook'},
  {label: 'Corporate Professional', value: 'Corporate Professional'},
  {label: 'Counselor', value: 'Counselor'},
  {label: 'Customer Support Executive', value: 'Customer Support Executive'},
  {label: 'Data Analyst', value: 'Data Analyst'},
  {label: 'Delivery Partner', value: 'Delivery Partner'},
  {label: 'Dentist', value: 'Dentist'},
  {label: 'Designer', value: 'Designer'},
  {label: 'Digital Marketer', value: 'Digital Marketer'},
  {label: 'Director', value: 'Director'},
  {label: 'Doctor', value: 'Doctor'},
  {label: 'Driver', value: 'Driver'},
  {label: 'Editor', value: 'Editor'},
  {label: 'Electrician', value: 'Electrician'},
  {label: 'Engineer', value: 'Engineer'},
  {label: 'Event Manager', value: 'Event Manager'},
  {label: 'Farmer', value: 'Farmer'},
  {label: 'Fashion Designer', value: 'Fashion Designer'},
  {label: 'Financial Advisor', value: 'Financial Advisor'},
  {label: 'Graphic Designer', value: 'Graphic Designer'},
  {label: 'Government Officer', value: 'Government Officer'},
  {label: 'Hair Stylist', value: 'Hair Stylist'},
  {label: 'Hotel Manager', value: 'Hotel Manager'},
  {label: 'HR Manager', value: 'HR Manager'},
  {label: 'Homemaker', value: 'Homemaker'},
  {label: 'Interior Designer', value: 'Interior Designer'},
  {label: 'IT Professional', value: 'IT Professional'},
  {label: 'Journalist', value: 'Journalist'},
  {label: 'Judge', value: 'Judge'},
  {label: 'Lab Technician', value: 'Lab Technician'},
  {label: 'Labourer', value: 'Labourer'},
  {label: 'Lawyer', value: 'Lawyer'},
  {label: 'Lecturer', value: 'Lecturer'},
  {label: 'Legal Advisor', value: 'Legal Advisor'},
  {label: 'Manager', value: 'Manager'},
  {label: 'Marketing Executive', value: 'Marketing Executive'},
  {label: 'Mechanic', value: 'Mechanic'},
  {label: 'Medical Officer', value: 'Medical Officer'},
  {label: 'Medical Representative', value: 'Medical Representative'},
  {label: 'Nurse', value: 'Nurse'},
  {label: 'Office Assistant', value: 'Office Assistant'},
  {label: 'Operations Manager', value: 'Operations Manager'},
  {label: 'Painter', value: 'Painter'},
  {label: 'Pharmacist', value: 'Pharmacist'},
  {label: 'Photographer', value: 'Photographer'},
  {label: 'Physiotherapist', value: 'Physiotherapist'},
  {label: 'Pilot', value: 'Pilot'},
  {label: 'Plumber', value: 'Plumber'},
  {label: 'Police Officer', value: 'Police Officer'},
  {label: 'Professor', value: 'Professor'},
  {label: 'Project Manager', value: 'Project Manager'},
  {label: 'Property Dealer', value: 'Property Dealer'},
  {label: 'Psychologist', value: 'Psychologist'},
  {label: 'Researcher', value: 'Researcher'},
  {label: 'Restaurant Owner', value: 'Restaurant Owner'},
  {label: 'Sales Executive', value: 'Sales Executive'},
  {label: 'Security Guard', value: 'Security Guard'},
  {label: 'Shop Owner', value: 'Shop Owner'},
  {label: 'Social Media Manager', value: 'Social Media Manager'},
  {label: 'Social Worker', value: 'Social Worker'},
  {label: 'Software Developer', value: 'Software Developer'},
  {label: 'Stock Trader', value: 'Stock Trader'},
  {label: 'Store Manager', value: 'Store Manager'},
  {label: 'Student', value: 'Student'},
  {label: 'Teacher', value: 'Teacher'},
  {label: 'Technician', value: 'Technician'},
  {label: 'Trader', value: 'Trader'},
  {label: 'Trainer', value: 'Trainer'},
  {label: 'Transport Operator', value: 'Transport Operator'},
  {label: 'Travel Agent', value: 'Travel Agent'},
  {label: 'UI/UX Designer', value: 'UI/UX Designer'},
  {label: 'Video Editor', value: 'Video Editor'},
  {label: 'Warehouse Manager', value: 'Warehouse Manager'},
  {label: 'Web Developer', value: 'Web Developer'},
  {label: 'Welder', value: 'Welder'},
  {label: 'Other (Manual)', value: 'manual'},
];

const normalizeImageUri = uri => {
  if (!uri) {
    return '';
  }
  if (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('file://') ||
    uri.startsWith('content://')
  ) {
    return uri;
  }
  return `file://${uri}`;
};

const MoreScreen = ({navigation, route, user, onProfileUpdate}) => {
  const routeUser = route.params?.user;
  const [currentUser, setCurrentUser] = React.useState(
    user || routeUser || {},
  );
  const [profileVisible, setProfileVisible] = React.useState(false);
  const [draftName, setDraftName] = React.useState('');
  const [draftPhoto, setDraftPhoto] = React.useState('');
  const [draftDob, setDraftDob] = React.useState('');
  const [draftPhoneNumber, setDraftPhoneNumber] = React.useState('');
  const [draftGender, setDraftGender] = React.useState('');
  const [occupationChoice, setOccupationChoice] = React.useState('');
  const [manualOccupation, setManualOccupation] = React.useState('');
  const [occupationModalVisible, setOccupationModalVisible] =
    React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [photoPreviewVisible, setPhotoPreviewVisible] = React.useState(false);
  const slideX = React.useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const profileSlideX = React.useRef(new Animated.Value(screenWidth)).current;
  const isSlidingRef = React.useRef(false);
  const skipNextSlideInRef = React.useRef(false);
  const profileVisibleRef = React.useRef(false);
  const profileBackRef = React.useRef(() => {});
  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const {dx, dy} = gestureState;
        return Math.abs(dx) > Math.abs(dy) && dx > 10;
      },
      onPanResponderGrant: () => {
        if (!profileVisibleRef.current) {
          slideX.stopAnimation();
        }
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (profileVisibleRef.current) {
          return;
        }
        const nextValue = Math.max(0, Math.min(screenWidth, gestureState.dx));
        slideX.setValue(nextValue);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (profileVisibleRef.current) {
          profileBackRef.current();
          return;
        }
        const shouldClose =
          gestureState.dx > screenWidth * 0.25 || gestureState.vx > 0.6;
        if (shouldClose) {
          handleBack();
          return;
        }
        Animated.timing(slideX, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        if (profileVisibleRef.current) {
          return;
        }
        Animated.timing(slideX, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;
  const profilePanResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const {dx, dy} = gestureState;
        return Math.abs(dx) > Math.abs(dy) && dx > 10;
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const shouldClose =
          gestureState.dx > screenWidth * 0.25 || gestureState.vx > 0.6;
        if (shouldClose) {
          profileBackRef.current();
        }
      },
    }),
  ).current;

  React.useEffect(() => {
    if (user || routeUser) {
      setCurrentUser(user || routeUser);
    }
  }, [user, routeUser]);

  React.useEffect(() => {
    profileVisibleRef.current = profileVisible;
  }, [profileVisible]);

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        if (stored) {
          setCurrentUser(JSON.parse(stored));
          return;
        }
        setCurrentUser(user || routeUser || {});
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    const runSlideIn = () => {
      slideX.setValue(screenWidth);
      Animated.timing(slideX, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    };
    const handleFocus = () => {
      loadUser();
      if (skipNextSlideInRef.current) {
        skipNextSlideInRef.current = false;
        slideX.setValue(0);
        return;
      }
      runSlideIn();
    };
    const unsubscribe = navigation.addListener('focus', handleFocus);
    handleFocus();
    return unsubscribe;
  }, [navigation, user, routeUser, screenWidth, slideX]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            // Sign out from Google (safe to call even if not signed in)
            await GoogleSignin.signOut();
            // Sign out from Firebase
            await auth().signOut();
            // Clear local storage
            await AsyncStorage.clear();
            await clearLocalData();
            await clearAllAccountsData();
            await clearAllLedgerData();
            navigation.replace('Login');
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout');
          }
        },
      },
    ]);
  };

  const openProfile = () => {
    const currentOccupation = currentUser?.occupation || '';
    const matchedOption = OCCUPATION_OPTIONS.find(
      option => option.value !== 'manual' && option.value === currentOccupation,
    );
    if (matchedOption) {
      setOccupationChoice(matchedOption.value);
      setManualOccupation('');
    } else if (currentOccupation) {
      setOccupationChoice('manual');
      setManualOccupation(currentOccupation);
    } else {
      setOccupationChoice('');
      setManualOccupation('');
    }
    setDraftName(currentUser?.displayName || '');
    setDraftPhoto(normalizeImageUri(currentUser?.photoURL || ''));
    setDraftDob(currentUser?.dob || '');
    setDraftPhoneNumber(currentUser?.phoneNumber || '');
    setDraftGender(currentUser?.gender || '');
    setProfileVisible(true);
    profileSlideX.setValue(screenWidth);
    Animated.timing(profileSlideX, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closeProfile = React.useCallback(() => {
    setPhotoPreviewVisible(false);
    setOccupationModalVisible(false);
    Animated.timing(profileSlideX, {
      toValue: screenWidth,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setProfileVisible(false);
    });
  }, [profileSlideX, screenWidth]);

  const openPhotoPreview = () => {
    if (!draftPhoto) {
      return;
    }
    setPhotoPreviewVisible(true);
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        freeStyleCropEnabled: true,
        cropperToolbarTitle: 'Crop Photo',
        cropperActiveWidgetColor: colors.primary,
        cropperStatusBarColor: colors.primary,
        cropperToolbarColor: colors.primary,
        cropperToolbarWidgetColor: colors.white,
        compressImageQuality: 0.9,
      });
      if (result?.path) {
        setDraftPhoto(normalizeImageUri(result.path));
        return;
      }
    } catch (error) {
      if (error?.code === 'E_PICKER_CANCELLED') {
        return;
      }
      console.error('Failed to pick image:', error);
      Alert.alert('Error', 'Failed to open photo library.');
    }
  };

  const handleSaveProfile = async () => {
    if (!draftName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    // Validate mobile number if provided
    if (draftPhoneNumber.trim() && !/^\d{10}$/.test(draftPhoneNumber.trim())) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setSaving(true);
    try {
      const occupationValue =
        occupationChoice === 'manual'
          ? manualOccupation.trim()
          : occupationChoice;
      const normalizedPhoto = normalizeImageUri(draftPhoto || '');

      // Get firebaseUid
      const firebaseUid = currentUser?.firebaseUid || await AsyncStorage.getItem('firebaseUid');

      if (!firebaseUid) {
        Alert.alert('Error', 'User authentication error. Please login again.');
        return;
      }

      // Call backend API to update profile
      const response = await updateProfile(firebaseUid, {
        displayName: draftName.trim(),
        mobile: draftPhoneNumber.trim() || null,
        dob: draftDob.trim() || null,
        gender: draftGender || null,
        occupation: occupationValue || null,
        setupComplete: true, // Mark setup as complete
      });

      if (response.success) {
        // Update Firebase auth profile (photo is managed separately)
        if (auth().currentUser) {
          await auth().currentUser.updateProfile({
            displayName: draftName.trim(),
            photoURL: normalizedPhoto,
          });
        }

        // Merge backend response with local photo URL
        const updatedUser = {
          ...response.user,
          photoURL: normalizedPhoto,
          phoneNumber: draftPhoneNumber.trim(),
        };

        setCurrentUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        queueBackupFromStorage();

        Alert.alert('Success', 'Profile updated successfully!');
        closeProfile();
      } else {
        Alert.alert('Error', response.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const getDraftOccupationValue = () => {
    return occupationChoice === 'manual'
      ? manualOccupation.trim()
      : occupationChoice;
  };

  const hasProfileChanges = () => {
    const nameChanged =
      draftName.trim() !== String(currentUser?.displayName || '').trim();
    const photoChanged =
      normalizeImageUri(draftPhoto || '') !==
      normalizeImageUri(currentUser?.photoURL || '');
    const dobChanged =
      draftDob.trim() !== String(currentUser?.dob || '').trim();
    const phoneChanged =
      draftPhoneNumber.trim() !== String(currentUser?.phoneNumber || '').trim();
    const genderChanged =
      draftGender !== String(currentUser?.gender || '');
    const occupationChanged =
      getDraftOccupationValue() !== String(currentUser?.occupation || '');
    return (
      nameChanged ||
      photoChanged ||
      dobChanged ||
      phoneChanged ||
      genderChanged ||
      occupationChanged
    );
  };

  const handleProfileBack = React.useCallback(() => {
    if (!profileVisible) {
      return;
    }
    if (!hasProfileChanges()) {
      closeProfile();
      return;
    }
    Alert.alert('Discard changes?', 'Do you want to save your changes?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          closeProfile();
        },
      },
      {
        text: 'Save',
        onPress: () => {
          handleSaveProfile();
        },
      },
    ]);
  }, [profileVisible, hasProfileChanges, closeProfile, handleSaveProfile]);

  React.useEffect(() => {
    profileBackRef.current = handleProfileBack;
  }, [handleProfileBack]);

  const menuItems = [
    {
      id: 'profile',
      title: 'Profile',
      icon: 'person-outline',
      onPress: openProfile,
    },
    {
      id: 'backup',
      title: 'Backup & Restore',
      icon: 'cloud-upload-outline',
      onPress: () => navigation.navigate('Backup'),
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings-outline',
      onPress: () => {
        skipNextSlideInRef.current = true;
        navigation.navigate('Settings');
      },
    },
    {
      id: 'help',
      title: 'Help & Support',
      icon: 'help-circle-outline',
      onPress: () =>
        Alert.alert('Coming Soon', 'Help & Support feature coming soon'),
    },
    {
      id: 'about',
      title: 'About',
      icon: 'information-circle-outline',
      onPress: () => {
        const versionName = NativeModules?.VersionInfo?.versionName ?? 'unknown';
        const versionCode = NativeModules?.VersionInfo?.versionCode ?? 'unknown';
        Alert.alert('Account App', `Version ${versionName} (${versionCode})`);
      },
    },
  ];

  const handleBack = React.useCallback(() => {
    if (isSlidingRef.current) {
      return;
    }
    isSlidingRef.current = true;
    Animated.timing(slideX, {
      toValue: screenWidth,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      isSlidingRef.current = false;
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      navigation.navigate('Dashboard');
    });
  }, [navigation, screenWidth, slideX]);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (profileVisible) {
          handleProfileBack();
          return true;
        }
        handleBack();
        return true;
      };
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );
      return () => subscription.remove();
    }, [handleBack, profileVisible, handleProfileBack]),
  );

  // Handle gesture-based back navigation (swipe from edge)
  React.useEffect(() => {
    const unsubscribeNavigation = navigation.addListener('beforeRemove', (e) => {
      if (profileVisibleRef.current) {
        e.preventDefault();
        profileBackRef.current();
      }
    });
    return unsubscribeNavigation;
  }, [navigation]);

  const profilePhotoUri = normalizeImageUri(currentUser?.photoURL || '');
  const draftPhotoUri = normalizeImageUri(draftPhoto || '');

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.animatedContainer, {transform: [{translateX: slideX}]}]}
        {...panResponder.panHandlers}>
        <View style={styles.moreHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityLabel="Go back">
            <Icon name="chevron-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.moreHeaderTitle}>More</Text>
          <View style={styles.moreHeaderSpacer} />
        </View>
        <ScrollView style={styles.scrollView}>
          <TouchableOpacity
            style={styles.profileSection}
            onPress={openProfile}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Open profile settings">
            {profilePhotoUri ? (
              <Image
                source={{uri: profilePhotoUri}}
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Icon name="person" size={28} color={colors.white} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {currentUser?.displayName || 'User'}
              </Text>
              <Text style={styles.profileEmail}>{currentUser?.email || ''}</Text>
            </View>
            <Icon
              name="chevron-forward"
              size={20}
              color={colors.text.light}
              style={styles.profileArrow}
            />
          </TouchableOpacity>

          <View style={styles.menuSection}>
            {menuItems.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={item.onPress}>
                <Icon name={item.icon} size={24} color={colors.text.primary} />
                <Text style={styles.menuText}>{item.title}</Text>
                <Icon
                  name="chevron-forward"
                  size={20}
                  color={colors.text.light}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Icon name="log-out-outline" size={24} color={colors.error} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
      {profileVisible && (
        <Animated.View
          style={[
            styles.profileScreen,
            {transform: [{translateX: profileSlideX}]},
          ]}
          {...profilePanResponder.panHandlers}>
          <View style={styles.profileHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleProfileBack}
              accessibilityLabel="Close profile settings">
              <Icon name="chevron-back" size={22} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.profileHeaderTitle}>Profile Settings</Text>
            <View style={styles.moreHeaderSpacer} />
          </View>
          <ScrollView
            style={styles.profileScroll}
            contentContainerStyle={styles.profileContent}>
            <View style={styles.profileImageFrame}>
              <TouchableOpacity
                style={styles.profileImageButton}
                onPress={openPhotoPreview}
                activeOpacity={0.8}>
                {draftPhotoUri ? (
                  <Image
                    source={{uri: draftPhotoUri}}
                    style={styles.profileHeroImage}
                  />
                ) : (
                  <View style={styles.profileHeroPlaceholder}>
                    <Icon name="person" size={48} color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileEditButton}
                onPress={handlePickImage}
                accessibilityLabel="Change profile photo">
                <Icon name="pencil" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>

            <Text style={styles.profileLabel}>Email</Text>
            <TextInput
              style={[styles.profileInput, styles.profileInputDisabled]}
              value={currentUser?.email || ''}
              editable={false}
            />

            <Text style={styles.profileLabel}>Name</Text>
            <TextInput
              style={styles.profileInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Enter your name"
              editable={!saving}
            />

            <Text style={styles.profileLabel}>Phone Number</Text>
            <TextInput
              style={styles.profileInput}
              value={draftPhoneNumber}
              onChangeText={setDraftPhoneNumber}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
              editable={!saving}
            />

            <Text style={styles.profileLabel}>Gender</Text>
            <TouchableOpacity
              style={styles.occupationPicker}
              onPress={() => {
                Alert.alert('Gender', 'Select your gender', [
                  {text: 'Male', onPress: () => setDraftGender('Male')},
                  {text: 'Female', onPress: () => setDraftGender('Female')},
                  {text: 'Other', onPress: () => setDraftGender('Other')},
                ]);
              }}>
              <Text style={styles.occupationPickerText}>
                {draftGender || 'Select gender'}
              </Text>
              <Icon
                name="chevron-down"
                size={18}
                color={colors.text.secondary}
              />
            </TouchableOpacity>

            <Text style={styles.profileLabel}>DOB</Text>
            <TextInput
              style={styles.profileInput}
              value={draftDob}
              onChangeText={setDraftDob}
              placeholder="DD/MM/YYYY"
              keyboardType="numbers-and-punctuation"
              editable={!saving}
            />

            <Text style={styles.profileLabel}>Occupation</Text>
            <TouchableOpacity
              style={styles.occupationPicker}
              onPress={() => setOccupationModalVisible(true)}>
              <Text style={styles.occupationPickerText}>
                {occupationChoice === 'manual'
                  ? manualOccupation || 'Manual'
                  : occupationChoice || 'What do you do'}
              </Text>
              <Icon
                name="chevron-down"
                size={18}
                color={colors.text.secondary}
              />
            </TouchableOpacity>
            {occupationChoice === 'manual' && (
              <TextInput
                style={styles.profileInput}
                value={manualOccupation}
                onChangeText={setManualOccupation}
                placeholder="Enter occupation"
                editable={!saving}
              />
            )}

            <TouchableOpacity
              style={[
                styles.profileSaveButton,
                saving && styles.profileSaveButtonDisabled,
              ]}
              onPress={handleSaveProfile}
              disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.profileSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
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
              {draftPhotoUri ? (
                <Image
                  source={{uri: draftPhotoUri}}
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
            visible={occupationModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setOccupationModalVisible(false)}>
            <View style={styles.previewOverlay}>
              <TouchableOpacity
                style={styles.previewBackdrop}
                activeOpacity={1}
                onPress={() => setOccupationModalVisible(false)}
              />
              <View style={styles.occupationModalCard}>
                <Text style={styles.occupationModalTitle}>
                  Select Occupation
                </Text>
                <ScrollView style={styles.occupationList}>
                  {OCCUPATION_OPTIONS.map(option => {
                    const isSelected = occupationChoice === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.occupationOption,
                          isSelected && styles.occupationOptionSelected,
                        ]}
                        onPress={() => {
                          setOccupationChoice(option.value);
                          if (option.value !== 'manual') {
                            setManualOccupation('');
                          }
                          setOccupationModalVisible(false);
                        }}>
                        <Text
                          style={[
                            styles.occupationOptionText,
                            isSelected && styles.occupationOptionTextSelected,
                          ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  animatedContainer: {
    flex: 1,
  },
  moreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  moreHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  moreHeaderSpacer: {
    width: 32,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileArrow: {
    marginLeft: spacing.sm,
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  profilePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: fontSize.xlarge,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    fontSize: fontSize.medium,
    color: colors.text.secondary,
  },
  menuSection: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuText: {
    flex: 1,
    fontSize: fontSize.regular,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: {
    fontSize: fontSize.regular,
    fontWeight: fontWeight.semibold,
    color: colors.error,
    marginLeft: spacing.sm,
  },
  profileScreen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  profileScroll: {
    flex: 1,
  },
  profileContent: {
    padding: spacing.lg,
  },
  profileImageFrame: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  profileImageButton: {
    flex: 1,
  },
  profileHeroImage: {
    width: '100%',
    height: '100%',
    borderRadius: 90,
  },
  profileHeroPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileEditButton: {
    position: 'absolute',
    left: '50%',
    bottom: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{translateX: -16}],
  },
  profileLabel: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  profileInput: {
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: colors.border,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: fontSize.regular,
    color: colors.text.primary,
    marginBottom: spacing.md,
    backgroundColor: 'transparent',
  },
  profileInputDisabled: {
    color: colors.text.secondary,
    opacity: 0.8,
  },
  occupationPicker: {
    borderWidth: 0,
    borderBottomWidth: 1,
    borderColor: colors.border,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  occupationPickerText: {
    fontSize: fontSize.regular,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.sm,
  },
  profileSaveButton: {
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  profileSaveButtonDisabled: {
    opacity: 0.7,
  },
  profileSaveText: {
    color: colors.primary,
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
  occupationModalCard: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
  },
  occupationModalTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  occupationList: {
    maxHeight: 360,
  },
  occupationOption: {
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  occupationOptionSelected: {
    backgroundColor: colors.background,
  },
  occupationOptionText: {
    fontSize: fontSize.regular,
    color: colors.text.primary,
  },
  occupationOptionTextSelected: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
});

export default MoreScreen;
