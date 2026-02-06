import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  SectionList,
  TextInput,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  Share,
  Linking,
  DeviceEventEmitter,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Contacts from 'react-native-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {fetchUsersByPhones} from '../services/api';

const DEVICE_CONTACTS_CACHE_KEY = 'ledgerDeviceContacts';
const APP_USERS_CACHE_KEY = 'ledgerAppUsersCache';
const APP_USERS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const INVITE_MESSAGE = 'Join me on Account App.';

const requestIdle = typeof requestIdleCallback === 'function'
  ? requestIdleCallback
  : (cb) => setTimeout(() => cb({timeRemaining: () => 0, didTimeout: true}), 0);

const INITIAL_RENDER_COUNT = 8;
const WINDOW_SIZE = 5;

const logPerf = (label, start) => {
  const ms = Date.now() - start;
  console.log(`[AddContactPerf] ${label}: ${ms}ms`);
};

const ContactRow = React.memo(function ContactRow({item, isAppUser, onAdd, onInvite, optimisticActionId}) {
  const name = item.displayNameComputed || item.displayName || item.givenName || item.familyName || 'Unnamed Contact';
  const phone = item.phoneComputed || 'No phone number';
  const isOptimistic = optimisticActionId && String(item.recordID) === optimisticActionId;

  return (
    <Pressable
      onPress={() => onAdd(item)}
      android_ripple={{color: 'rgba(0,0,0,0.06)'}}
      style={({pressed}) => [
        styles.modalContactRow,
        pressed && styles.rowPressed,
        isOptimistic && styles.rowOptimistic,
      ]}>
      <View style={[styles.contactAvatar, styles.modalContactAvatar]}>
        <Text style={styles.contactAvatarText}>
          {(name || '?').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.modalContactDetails}>
        <Text style={styles.contactName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.contactPhone} numberOfLines={1}>
          {phone}
        </Text>
      </View>
      <View style={styles.contactAction}>
        <Icon name="add-circle-outline" size={20} color={colors.primary} />
      </View>
    </Pressable>
  );
});

const LedgerAddContactScreen = ({navigation, route}) => {
  const [contactOptions, setContactOptions] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchDebounceRef = useRef(null);
  const [appUsers, setAppUsers] = useState([]);
  const [inviteContacts, setInviteContacts] = useState([]);
  const [userLookupLoading, setUserLookupLoading] = useState(false);
  const [userLookupError, setUserLookupError] = useState('');
  const [listReady, setListReady] = useState(false);
  const [optimisticActionId, setOptimisticActionId] = useState(null);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);
  const [isOpening, setIsOpening] = useState(true);
  const contactsFetchInFlight = useRef(false);
  const appUsersFetchInFlight = useRef(false);
  const hasFreshCache = useRef(false);
  const isScreenActive = useRef(true);
  const skipInitialFetch = useRef(true);

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(contactSearch);
    }, 300);
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [contactSearch]);

  useEffect(() => {
    let cancelled = false;
    const task = requestIdle(() => {
      const loadCachedDeviceContacts = async () => {
        const start = Date.now();
        try {
          const cached = await AsyncStorage.getItem(DEVICE_CONTACTS_CACHE_KEY);
          logPerf('AsyncStorage read', start);
          if (cancelled || !isScreenActive.current) {
            return;
          }
          if (cached) {
            const parseStart = Date.now();
            const parsed = JSON.parse(cached);
            logPerf('JSON parse', parseStart);
            if (Array.isArray(parsed) && parsed.length > 0) {
              if (isScreenActive.current) {
                setContactOptions(parsed);
              }
            }
          }
        } catch (error) {
          console.error('Failed to load cached device contacts:', error);
        }
      };
      loadCachedDeviceContacts();
    });

    return () => {
      cancelled = true;
      if (task && typeof task.cancel === 'function') {
        task.cancel();
      }
    };
  }, []);

  useEffect(() => {
    const onFocus = navigation.addListener('focus', () => {
      isScreenActive.current = true;
      setListReady(false);
      requestIdle(() => {
        if (!isScreenActive.current) {
          return;
        }
        setListReady(true);
        setIsOpening(false);
        if (contactOptions.length === 0 && !skipInitialFetch.current) {
          loadDeviceContacts();
        }
        if (contactOptions.length === 0 && skipInitialFetch.current) {
          skipInitialFetch.current = false;
        }
      });
    });
    const onBlur = navigation.addListener('blur', () => {
      isScreenActive.current = false;
      setListReady(false);
    });
    return () => {
      onFocus();
      onBlur();
    };
  }, [navigation, contactOptions.length, loadDeviceContacts]);

  useEffect(() => {
    if (!listReady || contactOptions.length === 0) {
      return;
    }
    const runLookup = async () => {
      const usedCache = await loadAppUsersCache();
      if (!usedCache) {
        fetchAppUsers();
      }
    };
    runLookup();
  }, [listReady, contactOptions, loadAppUsersCache, fetchAppUsers]);

  const requestContactsPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS
      );
      if (alreadyGranted) {
        return true;
      }
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        {
          title: 'Contacts Permission',
          message: 'Allow access to your contacts to add people to ledger.',
          buttonPositive: 'Allow',
          buttonNegative: 'Cancel',
        }
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      }
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          'Permission Blocked',
          'Please enable contacts access in Settings.',
          [
            {text: 'Cancel', style: 'cancel'},
            {text: 'Open Settings', onPress: () => Linking.openSettings()},
          ]
        );
        return false;
      }
      return false;
    }

    const permission = await Contacts.requestPermission();
    return permission === 'authorized';
  }, []);

  const getContactNameFromDevice = useCallback(contact => {
    if (contact.displayNameComputed) {
      return contact.displayNameComputed;
    }
    const fullName = [contact.givenName, contact.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || contact.displayName || 'Unnamed Contact';
  }, []);

  const getContactPhone = useCallback(contact => {
    if (contact.phoneComputed) {
      return contact.phoneComputed;
    }
    const phone = contact.phoneNumbers?.find(item =>
      String(item.number || '').trim()
    )?.number;
    return phone || 'No phone number';
  }, []);

  const normalizeDeviceContacts = contactsList =>
    contactsList.map(contact => {
      const fullName = [contact.givenName, contact.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const displayNameComputed = fullName || contact.displayName || 'Unnamed Contact';
      const phoneComputed = contact.phoneNumbers?.find(item =>
        String(item.number || '').trim()
      )?.number || 'No phone number';
      const searchKey = `${displayNameComputed} ${phoneComputed}`.toLowerCase();
      const sortKey = displayNameComputed.toLowerCase();

      return {
        recordID: contact.recordID,
        displayName: contact.displayName || '',
        givenName: contact.givenName || '',
        familyName: contact.familyName || '',
        phoneNumbers: (contact.phoneNumbers || [])
          .map(item => ({number: item.number}))
          .filter(item => String(item.number || '').trim()),
        displayNameComputed,
        phoneComputed,
        searchKey,
        sortKey,
      };
    });

  const loadDeviceContacts = useCallback(async () => {
    if (contactsFetchInFlight.current) {
      return;
    }
    contactsFetchInFlight.current = true;
    const start = Date.now();
    try {
      const granted = await requestContactsPermission();
      logPerf('permission check', start);
      if (!granted) {
        Alert.alert('Permission Required', 'Please allow contacts access.');
        return;
      }
      const fetcher = Contacts.getAllWithoutPhotos || Contacts.getAll;
      const fetchStart = Date.now();
      const list = await fetcher();
      logPerf('contacts fetch', fetchStart);
      const filterStart = Date.now();
      const filtered = list.filter(contact => {
        const hasPhone = contact.phoneNumbers?.some(item =>
          String(item.number || '').trim()
        );
        const hasName = [contact.displayName, contact.givenName, contact.familyName]
          .some(value => String(value || '').trim());
        return hasPhone && hasName;
      });
      logPerf('contacts filter', filterStart);
      const normalizeStart = Date.now();
      const normalized = normalizeDeviceContacts(filtered);
      logPerf('contacts normalize', normalizeStart);

      const sortStart = Date.now();
      const sorted = normalized.sort((a, b) => {
        const aKey = a.sortKey || '';
        const bKey = b.sortKey || '';
        if (aKey < bKey) return -1;
        if (aKey > bKey) return 1;
        return 0;
      });
      logPerf('contacts sort', sortStart);

      if (isScreenActive.current) {
        setContactOptions(sorted);
      }
      const saveStart = Date.now();
      await AsyncStorage.setItem(
        DEVICE_CONTACTS_CACHE_KEY,
        JSON.stringify(sorted)
      );
      logPerf('contacts cache save', saveStart);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      Alert.alert('Error', 'Failed to load contacts.');
    } finally {
      logPerf('total loadDeviceContacts', start);
      contactsFetchInFlight.current = false;
    }
  }, [requestContactsPermission, getContactNameFromDevice]);

  const normalizePhoneForLookup = value => {
    if (!value) {
      return '';
    }
    const digits = String(value).replace(/\D/g, '');
    if (!digits) {
      return '';
    }
    if (digits.length > 10) {
      return digits.slice(-10);
    }
    if (digits.length < 8) {
      return '';
    }
    return digits;
  };

  const getLookupPhone = contact => {
    const raw = contact.phoneNumbers?.find(item =>
      String(item.number || '').trim()
    )?.number;
    return normalizePhoneForLookup(raw);
  };

  const buildContactLists = useCallback((usersByPhone) => {
    const appList = [];
    const inviteList = [];

    contactOptions.forEach(contact => {
      const lookupPhone = getLookupPhone(contact);
      if (lookupPhone && usersByPhone.has(lookupPhone)) {
        appList.push({
          ...contact,
          lookupPhone,
          appUser: usersByPhone.get(lookupPhone),
        });
      } else {
        inviteList.push({
          ...contact,
          lookupPhone,
        });
      }
    });

    setAppUsers(appList);
    setInviteContacts(inviteList);
  }, [contactOptions]);

  const loadAppUsersCache = useCallback(async () => {
    try {
      const cachedRaw = await AsyncStorage.getItem(APP_USERS_CACHE_KEY);
      if (!cachedRaw) {
        if (isScreenActive.current) {
          setAppUsers([]);
          setInviteContacts(contactOptions);
        }
        return false;
      }
      const cached = JSON.parse(cachedRaw);
      const ts = cached?.ts || 0;
      const users = Array.isArray(cached?.users) ? cached.users : [];
      if (!ts || users.length === 0 || Date.now() - ts > APP_USERS_CACHE_TTL_MS) {
        if (isScreenActive.current) {
          setAppUsers([]);
          setInviteContacts(contactOptions);
        }
        return false;
      }
      const usersByPhone = new Map();
      users.forEach(user => {
        const phone = normalizePhoneForLookup(user.mobile);
        if (phone) {
          usersByPhone.set(phone, user);
        }
      });
      hasFreshCache.current = true;
      if (isScreenActive.current) {
        buildContactLists(usersByPhone);
      }
      return true;
    } catch (error) {
      if (isScreenActive.current) {
        setAppUsers([]);
        setInviteContacts(contactOptions);
      }
      return false;
    }
  }, [contactOptions, buildContactLists]);

  const fetchAppUsers = useCallback(async (force = false) => {
    if (appUsersFetchInFlight.current) {
      return;
    }
    if (!force && hasFreshCache.current) {
      return;
    }
    appUsersFetchInFlight.current = true;
    if (isScreenActive.current) {
      setUserLookupLoading(true);
      setUserLookupError('');
    }

    try {
      const phoneStart = Date.now();
      const phones = contactOptions
        .map(getLookupPhone)
        .filter(Boolean);
      logPerf('phones map/filter', phoneStart);

      if (phones.length === 0) {
        if (isScreenActive.current) {
          setAppUsers([]);
          setInviteContacts(contactOptions);
        }
        return;
      }

      const fetchStart = Date.now();
      const response = await fetchUsersByPhones(phones);
      logPerf('users-by-phones fetch', fetchStart);
      const users = Array.isArray(response?.users) ? response.users : [];
      const usersByPhone = new Map();

      const mapStart = Date.now();
      users.forEach(user => {
        const phone = normalizePhoneForLookup(user.mobile);
        if (phone) {
          usersByPhone.set(phone, user);
        }
      });
      logPerf('users map', mapStart);

      if (isScreenActive.current) {
        const buildStart = Date.now();
        buildContactLists(usersByPhone);
        logPerf('buildContactLists', buildStart);
      }

      const saveStart = Date.now();
      await AsyncStorage.setItem(
        APP_USERS_CACHE_KEY,
        JSON.stringify({ts: Date.now(), users})
      );
      logPerf('users cache save', saveStart);
    } catch (error) {
      if (isScreenActive.current) {
        setUserLookupError('Failed to check app users');
        setAppUsers([]);
        setInviteContacts(contactOptions);
      }
    } finally {
      if (isScreenActive.current) {
        setUserLookupLoading(false);
      }
      appUsersFetchInFlight.current = false;
    }
  }, [contactOptions, buildContactLists]);

  const handleAddContact = useCallback((contact) => {
    setOptimisticActionId(String(contact.recordID));
    DeviceEventEmitter.emit('ledger:addContact', contact);
    isScreenActive.current = false;
    navigation.goBack();
  }, [navigation]);

  const handleInviteContact = useCallback(async (contact) => {
    setOptimisticActionId(String(contact.recordID));
    try {
      const name = getContactNameFromDevice(contact);
      const message = name ? `${INVITE_MESSAGE} - ${name}` : INVITE_MESSAGE;
      await Share.share({message});
    } catch (error) {
      Alert.alert('Error', 'Failed to open share');
    } finally {
      setOptimisticActionId(null);
    }
  }, [getContactNameFromDevice]);

  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  const filterContacts = useCallback(
    (list) => {
      if (!normalizedSearch) {
        return list;
      }
      return list.filter(item => {
        const key = item.searchKey || `${getContactNameFromDevice(item)} ${getContactPhone(item)}`.toLowerCase();
        return key.includes(normalizedSearch);
      });
    },
    [normalizedSearch, getContactNameFromDevice, getContactPhone],
  );

  const filteredAppUsers = useMemo(() => filterContacts(appUsers), [appUsers, filterContacts]);
  const filteredInviteContacts = useMemo(() => filterContacts(inviteContacts), [inviteContacts, filterContacts]);

  const sections = useMemo(
    () =>
      [
        {
          key: 'onApp',
          title: `On App (${filteredAppUsers.length})`,
          data: filteredAppUsers,
        },
        {
          key: 'invite',
          title: `Invite (${filteredInviteContacts.length})`,
          data: filteredInviteContacts,
        },
      ].filter(section => section.data.length > 0),
    [filteredAppUsers, filteredInviteContacts]
  );



  const renderContactOption = useCallback(({item, section}) => {
    const isAppUser = section?.key === 'onApp';
    return (
      <ContactRow
        item={item}
        isAppUser={isAppUser}
        onAdd={handleAddContact}
        onInvite={handleInviteContact}
        optimisticActionId={optimisticActionId}
      />
    );
  }, [handleAddContact, handleInviteContact]);

  const renderSectionHeader = useCallback(({section}) => (
    <View style={styles.modalSectionHeader}>
      <Text style={styles.modalSectionTitle}>{section.title}</Text>
    </View>
  ), []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (isNavigatingBack) {
              return;
            }
            setIsNavigatingBack(true);
            isScreenActive.current = false;
            navigation.goBack();
          }}
          disabled={isNavigatingBack}
          style={({pressed}) => [
            styles.backButton,
            (pressed || isNavigatingBack) && styles.backButtonPressed,
          ]}>
          <Icon name="chevron-back" size={22} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Contact</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" size={18} color={colors.text.secondary} />
        <TextInput
          style={styles.searchInput}
          value={contactSearch}
          onChangeText={setContactSearch}
          placeholder="Search by name or number"
          placeholderTextColor={colors.text.light}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
      {contactSearch !== debouncedSearch ? (
        <Text style={styles.searchingText}>Searching...</Text>
      ) : null}
      <Pressable
        onPress={() => {
          if (isScreenActive.current) {
            loadDeviceContacts();
          }
        }}
        android_ripple={{color: 'rgba(0,0,0,0.06)'}}
        style={({pressed}) => [styles.refreshButton, pressed && styles.refreshButtonPressed]}>
        <Icon name="refresh" size={16} color={colors.text.secondary} />
        <Text style={styles.refreshButtonText}>Refresh contacts</Text>
      </Pressable>
      <View>
          {userLookupLoading ? (
            <View style={styles.modalLookupBanner}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Checking app users...</Text>
            </View>
          ) : null}
          {userLookupError ? (
            <Text style={styles.modalErrorText}>{userLookupError}</Text>
          ) : null}
          {listReady ? (
            sections.length > 0 ? (
              <SectionList
                initialNumToRender={INITIAL_RENDER_COUNT}
                maxToRenderPerBatch={INITIAL_RENDER_COUNT}
                windowSize={WINDOW_SIZE}
                updateCellsBatchingPeriod={50}
                removeClippedSubviews
                sections={sections}
                keyExtractor={item => String(item.recordID)}
                renderItem={renderContactOption}
                renderSectionHeader={renderSectionHeader}
                contentContainerStyle={styles.modalList}
                stickySectionHeadersEnabled={false}
              />
            ) : (
              <View style={styles.modalEmpty}>
                <Icon name="people-outline" size={48} color={colors.text.light} />
                <Text style={styles.modalEmptyText}>
                  {normalizedSearch ? 'No matches found' : 'No contacts found'}
                </Text>
                <Text style={styles.modalEmptySubtext}>
                  {normalizedSearch
                    ? 'Try a different name or number'
                    : 'Try again or check contacts permission'}
                </Text>
              </View>
            )
          ) : null}
      </View>
      {isNavigatingBack ? (
        <View pointerEvents="none" style={styles.backOverlay} />
      ) : null}

      {isOpening ? (
        <View pointerEvents="none" style={styles.openOverlay} />
      ) : null}
    </View>
  );
};

const cardBase = {
  backgroundColor: colors.white,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#F3F4F6',
  elevation: 1,
  shadowColor: colors.black,
  shadowOffset: {width: 0, height: 1},
  shadowOpacity: 0.05,
  shadowRadius: 2,
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: colors.white,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 36,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    margin: spacing.md,
    backgroundColor: colors.white,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: fontSize.regular,
    color: colors.text.primary,
    paddingVertical: 4,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  refreshButtonPressed: {
    backgroundColor: '#F1F5F9',
  },
  refreshButtonText: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
  },
  modalLookupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalErrorText: {
    color: '#EF4444',
    fontSize: fontSize.small,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modalSectionHeader: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  modalList: {
    paddingBottom: spacing.sm,
  },
  rowPressed: {
    backgroundColor: '#F1F5F9',
  },
  rowOptimistic: {
    backgroundColor: '#E0F2FE',
  },
  modalContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  modalContactAvatar: {
    marginRight: spacing.md,
  },
  modalContactDetails: {
    flex: 1,
    minWidth: 0,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  contactAvatarText: {
    color: colors.white,
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
  },
  contactName: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  contactAction: {
    alignItems: 'flex-end',
  },
  inviteButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inviteButtonText: {
    color: colors.white,
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
  },
  modalLoading: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.text.secondary,
  },
  modalEmpty: {
    ...cardBase,
    padding: spacing.xl,
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  modalEmptyText: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  modalEmptySubtext: {
    fontSize: fontSize.small,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default LedgerAddContactScreen;


