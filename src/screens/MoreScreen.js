import React from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {auth} from '../config/firebase';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';

const MoreScreen = ({navigation, route}) => {
  const {user} = route.params || {};
  const [currentUser, setCurrentUser] = React.useState(user || {});
  const slideX = React.useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const isSlidingRef = React.useRef(false);
  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        const {dx, dy} = gestureState;
        return Math.abs(dx) > Math.abs(dy) && dx > 10;
      },
      onPanResponderGrant: () => {
        slideX.stopAnimation();
      },
      onPanResponderMove: (_evt, gestureState) => {
        const nextValue = Math.max(0, Math.min(screenWidth, gestureState.dx));
        slideX.setValue(nextValue);
      },
      onPanResponderRelease: (_evt, gestureState) => {
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
        Animated.timing(slideX, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const stored = await AsyncStorage.getItem('user');
        if (stored) {
          setCurrentUser(JSON.parse(stored));
          return;
        }
        setCurrentUser(user || {});
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
      runSlideIn();
    };
    const unsubscribe = navigation.addListener('focus', handleFocus);
    handleFocus();
    return unsubscribe;
  }, [navigation, user, screenWidth, slideX]);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await auth().signOut();
            await GoogleSignin.signOut();
            await AsyncStorage.clear();
            navigation.replace('Login');
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout');
          }
        },
      },
    ]);
  };

  const menuItems = [
    {
      id: 'profile',
      title: 'Profile',
      icon: 'person-outline',
      onPress: () => Alert.alert('Coming Soon', 'Profile feature coming soon'),
    },
    {
      id: 'backup',
      title: 'Backup & Restore',
      icon: 'cloud-upload-outline',
      onPress: () =>
        Alert.alert('Coming Soon', 'Backup & Restore feature coming soon'),
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: 'settings-outline',
      onPress: () => navigation.navigate('Settings'),
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
      onPress: () => Alert.alert('Account App', 'Version 1.0.0'),
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
        handleBack();
        return true;
      };
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );
      return () => subscription.remove();
    }, [handleBack]),
  );

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
          <View style={styles.profileSection}>
            {currentUser?.photoURL ? (
              <Image
                source={{uri: currentUser.photoURL}}
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
              {currentUser?.username && (
                <Text style={styles.profileUsername}>
                  @{currentUser.username}
                </Text>
              )}
            </View>
          </View>

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
  profileUsername: {
    fontSize: fontSize.medium,
    color: colors.primary,
    marginTop: spacing.xs,
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
});

export default MoreScreen;
