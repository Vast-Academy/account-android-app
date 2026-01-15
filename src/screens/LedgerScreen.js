import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  PermissionsAndroid,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
  Easing,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons'; // For push-pin icon
import Contacts from 'react-native-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {useToast} from '../hooks/useToast';
import {queueBackupFromStorage} from '../utils/backupQueue';
import {
  initLedgerDatabase,
  getAllContactBalances,
  getLedgerStatistics,
  deleteContactAndTransactions,
  setContactNickname,
  getContactNickname,
  deleteContactNickname,
  getLatestTransactionDateByContact,
} from '../services/ledgerDatabase';

const CONTACTS_STORAGE_KEY = 'ledgerContacts';
const PINNED_CONTACT_IDS_STORAGE_KEY = 'pinnedLedgerContactIds';
const DEVICE_CONTACTS_CACHE_KEY = 'ledgerDeviceContacts';

const LedgerScreen = ({navigation}) => {
  const {showToast} = useToast();
  const [contacts, setContacts] = useState([]);
  const [contactsHydrated, setContactsHydrated] = useState(false);
  const [contactOptions, setContactOptions] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsModalVisible, setContactsModalVisible] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contactBalances, setContactBalances] = useState({});
  const [overallBalance, setOverallBalance] = useState({
    totalPaid: 0,
    totalGet: 0,
    netBalance: 0,
  });
  const [latestTransactionDates, setLatestTransactionDates] = useState({});
  const slideAnim = useRef(new Animated.Value(0)).current;
  const contactsFetchInFlight = useRef(false);

  // For context menu
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [pinnedContactIds, setPinnedContactIds] = useState([]);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(300)).current;

  // For rename modal
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [originalContactName, setOriginalContactName] = useState('');


  useEffect(() => {
    const loadStoredData = async () => {
      try {
        initLedgerDatabase();
        const stored = await AsyncStorage.getItem(CONTACTS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            // Fetch nicknames for stored contacts
            const contactsWithNicknames = await Promise.all(parsed.map(async (contact) => {
                const nickname = await getContactNickname(contact.recordID);
                return { ...contact, nickname: nickname || null };
            }));
            setContacts(contactsWithNicknames);
          }
        }
        const storedPinned = await AsyncStorage.getItem(PINNED_CONTACT_IDS_STORAGE_KEY);
        if (storedPinned) {
          const parsedPinned = JSON.parse(storedPinned);
          setPinnedContactIds(Array.isArray(parsedPinned) ? parsedPinned : []);
        }
      } catch (error) {
        console.error('Failed to load stored data:', error);
      } finally {
        setContactsHydrated(true);
      }
    };
    loadStoredData();
  }, []);

  useEffect(() => {
    const loadCachedDeviceContacts = async () => {
      try {
        const cached = await AsyncStorage.getItem(DEVICE_CONTACTS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setContactOptions(parsed);
          }
        }
      } catch (error) {
        console.error('Failed to load cached device contacts:', error);
      }
    };
    loadCachedDeviceContacts();
  }, []);

  const getContactDisplayName = useCallback(async (contact) => {
    const nickname = await getContactNickname(contact.recordID);
    if (nickname) {
        return nickname;
    }
    const fullName = [contact.givenName, contact.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || contact.displayName || 'Unnamed Contact';
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      await loadBalances();
    });
    return unsubscribe;
  }, [navigation, contacts, getContactDisplayName]); // Add getContactDisplayName to dependencies

  const loadBalances = useCallback(async (contactsOverride) => {
    const baseContacts = contactsOverride || contacts;
    const balances = getAllContactBalances();
    setContactBalances(balances);
    const stats = getLedgerStatistics();
    setOverallBalance(stats);
    const latestDates = getLatestTransactionDateByContact();
    setLatestTransactionDates(latestDates);
  
    // Fetch nicknames for current contacts to ensure display names are updated
    const contactsWithUpdatedNicknames = await Promise.all(
      baseContacts.map(async (contact) => {
        const nickname = await getContactNickname(contact.recordID);
        return { ...contact, nickname: nickname || null };
      })
    );
    setContacts(current =>
      sortContactsByPinned(contactsWithUpdatedNicknames, pinnedContactIds, latestDates)
    );
  }, [contacts, pinnedContactIds]); // Add contacts to dependencies


  useEffect(() => {
    const persistContacts = async () => {
      try {
        const payload = contacts.map(contact => {
          const phone = contact.phoneNumbers?.find(item =>
            String(item.number || '').trim()
          )?.number;
          return {
            recordID: contact.recordID,
            displayName: contact.displayName || '',
            givenName: contact.givenName || '',
            familyName: contact.familyName || '',
            phoneNumbers: phone ? [{number: phone}] : [],
            // Do not persist nickname, it's stored in DB
          };
        });
        await AsyncStorage.setItem(
          CONTACTS_STORAGE_KEY,
          JSON.stringify(payload)
        );
        queueBackupFromStorage();
      } catch (error) {
        console.error('Failed to store contacts:', error);
      }
    };
    if (contactsHydrated) {
      persistContacts();
    }
  }, [contacts, contactsHydrated]);

  useEffect(() => {
    // Persist pinned IDs
    const persistPinnedIds = async () => {
      try {
        await AsyncStorage.setItem(PINNED_CONTACT_IDS_STORAGE_KEY, JSON.stringify(pinnedContactIds));
        queueBackupFromStorage();
      } catch (error) {
        console.error('Failed to save pinned contact IDs:', error);
      }
    };
    if (contactsHydrated) { // Only persist once contacts are loaded to avoid overwriting initial state
      persistPinnedIds();
      // Also resort contacts whenever pinnedContactIds change
      setContacts(current =>
        sortContactsByPinned(current, pinnedContactIds, latestTransactionDates)
      );
    }
  }, [pinnedContactIds, contactsHydrated, latestTransactionDates]);


  useEffect(() => {
    if (contactsModalVisible) {
      slideAnim.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [contactsModalVisible, slideAnim]);

  const requestContactsPermission = async () => {
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
  };

  const getContactNameFromDevice = contact => {
    const fullName = [contact.givenName, contact.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || contact.displayName || 'Unnamed Contact';
  };

  const getContactPhone = contact => {
    const phone = contact.phoneNumbers?.find(item =>
      String(item.number || '').trim()
    )?.number;
    return phone || 'No phone number';
  };

  const isContactAdded = contact =>
    contacts.some(item => item.recordID === contact.recordID);

  const normalizeDeviceContacts = contactsList =>
    contactsList.map(contact => ({
      recordID: contact.recordID,
      displayName: contact.displayName || '',
      givenName: contact.givenName || '',
      familyName: contact.familyName || '',
      phoneNumbers: (contact.phoneNumbers || [])
        .map(item => ({number: item.number}))
        .filter(item => String(item.number || '').trim()),
    }));

  const loadDeviceContacts = async ({showLoading = true} = {}) => {
    if (contactsFetchInFlight.current) {
      return;
    }
    contactsFetchInFlight.current = true;
    if (showLoading) {
      setLoadingContacts(true);
    }
    try {
      const granted = await requestContactsPermission();
      if (!granted) {
        if (showLoading) {
          Alert.alert('Permission Required', 'Please allow contacts access.');
          setContactsModalVisible(false);
        }
        return;
      }
      const fetcher = Contacts.getAllWithoutPhotos || Contacts.getAll;
      const list = await fetcher();
      const filtered = list.filter(contact => {
        const hasPhone = contact.phoneNumbers?.some(item =>
          String(item.number || '').trim()
        );
        const hasName = [contact.displayName, contact.givenName, contact.familyName]
          .some(value => String(value || '').trim());
        return hasPhone && hasName;
      });
      const sorted = filtered.sort((a, b) =>
        getContactNameFromDevice(a).localeCompare(getContactNameFromDevice(b))
      );
      const normalized = normalizeDeviceContacts(sorted);
      setContactOptions(normalized);
      await AsyncStorage.setItem(
        DEVICE_CONTACTS_CACHE_KEY,
        JSON.stringify(normalized)
      );
    } catch (error) {
      console.error('Failed to load contacts:', error);
      Alert.alert('Error', 'Failed to load contacts.');
    } finally {
      contactsFetchInFlight.current = false;
      if (showLoading) {
        setLoadingContacts(false);
      }
    }
  };

  const openContactsModal = () => {
    setContactsModalVisible(true);
    setContactSearch('');
    if (contactOptions.length === 0) {
      loadDeviceContacts();
    }
  };

  const closeContactsModal = () => {
    setContactsModalVisible(false);
  };

  const handleAddContact = async contact => {
    const nickname = await getContactNickname(contact.recordID);
    const contactWithNickname = { ...contact, nickname: nickname || null };

    setContacts(prev => {
      if (prev.some(item => item.recordID === contact.recordID)) {
        return prev;
      }
      const next = [...prev, contactWithNickname];
      return sortContactsByPinned(next, pinnedContactIds, latestTransactionDates);
    });
    setContactsModalVisible(false);
    showToast('Contact added successfully', 'success');
  };

  const formatCurrency = amount => {
    return `₹${Math.abs(amount).toLocaleString('en-IN')}`;
  };

  const formatSignedBalance = amount => {
    if (amount < 0) {
      return `- ${formatCurrency(amount)}`;
    }
    return formatCurrency(amount);
  };

  // Helper function for sorting contacts by pinned status
  const sortContactsByPinned = (contactsList, pinnedIds, latestDates = {}) => {
    if (!contactsList || contactsList.length === 0) {
      return [];
    }
    const pinnedOrder = new Map();
    pinnedIds.forEach((id, index) => {
      pinnedOrder.set(id, index);
    });

    const pinned = contactsList.filter(contact => pinnedOrder.has(contact.recordID));
    const unpinned = contactsList.filter(contact => !pinnedOrder.has(contact.recordID));

    pinned.sort((a, b) => pinnedOrder.get(a.recordID) - pinnedOrder.get(b.recordID));
    // Sort unpinned contacts by latest transaction date (newest first)
    unpinned.sort((a, b) => {
        const dateA = latestDates[a.recordID] || 0;
        const dateB = latestDates[b.recordID] || 0;
        // Descending order: most recent first
        return dateB - dateA;
    });

    return [...pinned, ...unpinned];
  };

  const openContextMenu = async (contact) => {
    setSelectedContact(contact);
    setOriginalContactName(await getContactDisplayName(contact)); // Store original name for context menu header
    setContextMenuVisible(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(contentTranslateY, {
        toValue: 0,
        tension: 65,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeContextMenu = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateY, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setContextMenuVisible(false);
      setSelectedContact(null);
      setOriginalContactName('');
    });
  };

  const handleDeleteContact = () => {
    if (!selectedContact) {
      return;
    }
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to delete ${selectedContact.nickname || getContactNameFromDevice(selectedContact)} and all its transactions? This action cannot be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from pinned list if present
              setPinnedContactIds(prev => prev.filter(id => id !== selectedContact.recordID));
              // Delete from database
              await deleteContactAndTransactions(selectedContact.recordID);
              // Remove from local contacts state
              const nextContacts = contacts.filter(
                c => c.recordID !== selectedContact.recordID
              );
              setContacts(nextContacts);
              await loadBalances(nextContacts); // Refresh balances and stats, await it
              closeContextMenu();
              showToast('Contact and transactions deleted.', 'success');
            } catch (error) {
              console.error('Failed to delete contact:', error);
              Alert.alert('Error', 'Failed to delete contact and transactions.');
            }
          },
        },
      ]
    );
  };

  const openRenameModal = async () => {
    if (!selectedContact) {
      return;
    }
    const currentNickname = await getContactNickname(selectedContact.recordID);
    setNewNickname(currentNickname || getContactNameFromDevice(selectedContact));
    setRenameModalVisible(true);
    closeContextMenu(); // Close context menu when rename modal opens
  };

  const closeRenameModal = () => {
    setRenameModalVisible(false);
    setNewNickname('');
  };

  const handleSaveNickname = async () => {
    if (!selectedContact || !newNickname.trim()) {
      Alert.alert('Invalid Name', 'Nickname cannot be empty.');
      return;
    }
    try {
      await setContactNickname(selectedContact.recordID, newNickname.trim());
      // Update the nickname in the local contacts state
      setContacts(prev => prev.map(c => 
        c.recordID === selectedContact.recordID ? { ...c, nickname: newNickname.trim() } : c
      ));
      await loadBalances(); // Refresh balances and stats
      closeRenameModal();
      Alert.alert('Success', 'Contact renamed successfully.');
    } catch (error) {
      console.error('Failed to save nickname:', error);
      Alert.alert('Error', 'Failed to save nickname.');
    }
  };

  const togglePinContact = () => {
    if (!selectedContact) {
      return;
    }
    const isPinned = pinnedContactIds.includes(selectedContact.recordID);
    setPinnedContactIds(prev => {
      if (isPinned) {
        return prev.filter(id => id !== selectedContact.recordID);
      } else {
        return [selectedContact.recordID, ...prev];
      }
    });
    closeContextMenu();
  };

  const normalizedSearch = contactSearch.trim().toLowerCase();
  const filteredContactOptions = normalizedSearch
    ? contactOptions.filter(item => {
        const name = item.nickname || getContactNameFromDevice(item);
        const phone = getContactPhone(item);
        return name.toLowerCase().includes(normalizedSearch) || phone.includes(normalizedSearch);
      })
    : contactOptions;

  const renderContact = ({item, index}) => {
    const name = item.nickname || getContactNameFromDevice(item);
    const balance = contactBalances[item.recordID] || {
      netBalance: 0,
    };
  
    const balanceStatus =
      balance.netBalance > 0
        ? 'positive'
        : balance.netBalance < 0
        ? 'negative'
        : 'neutral';
  
    const statusText =
      balanceStatus === 'positive'
        ? 'You will get'
        : balanceStatus === 'negative'
        ? 'You will give'
        : 'Settled';
  
    const isPinned = pinnedContactIds.includes(item.recordID);

    return (
      <TouchableOpacity
        style={[styles.contactItem, index === contacts.length - 1 && styles.lastContactItem]}
        onPress={() => navigation.navigate('LedgerContactDetail', {contact: item})}
        onLongPress={() => openContextMenu(item)}
        activeOpacity={0.8}>
        <View style={styles.contactRow}>
          <View style={styles.contactAvatar}>
            <Text style={styles.contactAvatarText}>
              {(name || '?').charAt(0).toUpperCase()}
            </Text>
            {isPinned && (
              <View style={styles.pinnedBadge}>
                <MaterialIcon name="push-pin" size={12} color={colors.white} />
              </View>
            )}
          </View>
          <View style={styles.contactDetails}>
            <Text style={styles.contactName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.balanceText, styles[`balance_${balanceStatus}`]]}>
              {statusText}
            </Text>
          </View>
          <View style={styles.balanceInfo}>
            <Text style={[styles.balanceAmount, styles[`balance_${balanceStatus}`]]}>
              {formatCurrency(balance.netBalance)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderContactOption = ({item}) => {
    const name = item.nickname || getContactNameFromDevice(item);
    const phone = getContactPhone(item);
    const added = isContactAdded(item);
    return (
      <TouchableOpacity
        style={[styles.modalContactRow, added && styles.contactRowDisabled]}
        onPress={() => handleAddContact(item)}
        disabled={added}
        activeOpacity={0.7}>
        <View style={[styles.contactAvatar, styles.modalContactAvatar]}>
          <Text style={styles.contactAvatarText}>
            {(name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.modalContactDetails}>
          <Text style={styles.contactName} numberOfLines={1}>
            {name || 'Unnamed Contact'}
          </Text>
          <Text style={styles.contactPhone} numberOfLines={1}>
            {phone}
          </Text>
        </View>
        <View style={styles.contactAction}>
          {added ? (
            <Text style={styles.contactAddedText}>Added</Text>
          ) : (
            <Icon name="add-circle-outline" size={20} color={colors.primary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header + Totals */}
      <View style={styles.headerBlock}>
        <View style={styles.headerRow} />
        <View style={styles.metricsRow}>
          <View style={styles.metricColumn}>
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabel}>Total Paid</Text>
            </View>
            <Text style={[styles.metricValue, styles.metricNegative]}>
              {formatCurrency(overallBalance.totalPaid)}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricColumn}>
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabel}>Total Received</Text>
            </View>
            <Text style={[styles.metricValue, styles.metricPositive]}>
              {formatCurrency(overallBalance.totalGet)}
            </Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricColumn}>
            <View style={styles.metricLabelRow}>
              <Text style={styles.metricLabel}>Net Balance</Text>
            </View>
            <Text
              style={[
                styles.metricValue,
                overallBalance.netBalance < 0
                  ? styles.metricPositive
                  : overallBalance.netBalance > 0
                  ? styles.metricNegative
                  : null,
              ]}>
              {formatSignedBalance(overallBalance.netBalance)}
            </Text>
          </View>
        </View>
      </View>
      
      <ScrollView style={styles.listScrollView}>
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>Contacts</Text>
          {contacts.length > 0 ? (
            <View style={styles.contactsListWrapper}>
              <FlatList
                data={contacts}
                keyExtractor={item => String(item.recordID)}
                renderItem={renderContact}
                scrollEnabled={false} 
              />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Icon
                name="people-outline"
                size={48}
                color={colors.text.light}
              />
              <Text style={styles.emptyText}>
                No contacts in ledger
              </Text>
              <Text style={styles.emptySubtext}>
                Tap the add button to get started
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={contactsModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeContactsModal}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeContactsModal}
          />
          <Animated.View
            style={[
              styles.modalCard,
              {
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [320, 0],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Contact</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={closeContactsModal}>
                <Icon name="close" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Icon name="search" size={18} color={colors.text.secondary} />
              <TextInput
                style={styles.modalSearchInput}
                value={contactSearch}
                onChangeText={setContactSearch}
                placeholder="Search by name or number"
                placeholderTextColor={colors.text.light}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            {loadingContacts ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading contacts...</Text>
              </View>
            ) : filteredContactOptions.length > 0 ? (
              <FlatList
                data={filteredContactOptions}
                keyExtractor={item => String(item.recordID)}
                renderItem={renderContactOption}
                contentContainerStyle={styles.modalList}
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
            )}
          </Animated.View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.fab} onPress={openContactsModal}>
        <Icon name="person-add" size={22} color={colors.white} />
      </TouchableOpacity>

      {/* Context Menu Modal */}
      <Modal
        visible={contextMenuVisible}
        transparent
        animationType="none"
        onRequestClose={closeContextMenu}>
        <Animated.View
          style={[
            styles.contextMenuOverlay,
            {opacity: overlayOpacity},
          ]}>
          <TouchableOpacity
            style={styles.contextMenuOverlayTouchable}
            activeOpacity={1}
            onPress={closeContextMenu}
          />
          <Animated.View
            style={[
              styles.contextMenuContainer,
              {transform: [{translateY: contentTranslateY}]},
            ]}>
            <View style={styles.contextMenuHeader}>
              <Text style={styles.contextMenuTitle}>
                {originalContactName}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={togglePinContact}>
              <MaterialIcon
                name="push-pin"
                size={22}
                color={colors.text.primary}
              />
              <Text style={styles.contextMenuItemText}>
                {pinnedContactIds.includes(selectedContact?.recordID)
                  ? 'Unpin from Top'
                  : 'Pin to Top'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={openRenameModal}>
              <Icon name="create-outline" size={22} color={colors.text.primary} />
              <Text style={styles.contextMenuItemText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={handleDeleteContact}>
              <Icon name="trash-outline" size={22} color="#EF4444" />
              <Text style={[styles.contextMenuItemText, {color: '#EF4444'}]}>
                Delete
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contextMenuItem, styles.contextMenuItemCancel]}
              onPress={closeContextMenu}>
              <Icon name="close" size={22} color={colors.text.secondary} />
              <Text style={styles.contextMenuItemTextCancel}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>

      {/* Rename Contact Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRenameModal}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeRenameModal}
          />
          <View style={styles.renameModalContainer}>
            <Text style={styles.renameModalTitle}>Rename Contact</Text>
            <Text style={styles.renameModalLabel}>Nickname</Text>
            <TextInput
              style={styles.renameModalInput}
              value={newNickname}
              onChangeText={setNewNickname}
              placeholder="Enter new nickname"
              placeholderTextColor={colors.text.light}
              autoFocus
            />
            <View style={styles.renameModalButtons}>
              <TouchableOpacity
                style={[styles.renameModalButton, styles.renameModalCancelButton]}
                onPress={closeRenameModal}>
                <Text style={styles.renameModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.renameModalButton, styles.renameModalSaveButton]}
                onPress={handleSaveNickname}>
                <Text style={styles.renameModalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerBlock: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    elevation: 2,
  },
  headerRow: {
    height: 28,
    marginBottom: spacing.sm,
  },
  metricsRow: {
    flexDirection: 'row',
  },
  metricColumn: {
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#E5E7EB',
    marginHorizontal: spacing.sm,
  },
  metricLabelRow: {
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  metricValue: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
  },
  metricPositive: {
    color: '#10B981',
  },
  metricNegative: {
    color: '#EF4444',
  },
  listScrollView: {
    flex: 1,
    padding: spacing.md,
  },
  listContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  contactsListWrapper: {
    ...cardBase,
    overflow: 'hidden',
  },
  contactItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lastContactItem: {
    borderBottomWidth: 0,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12, // Squircle
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
  pinnedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.primary, // Or any distinct color for pinned
    borderRadius: 8,
    padding: 2,
  },
  contactDetails: {
    flex: 1,
    minWidth: 0,
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
  balanceInfo: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  balanceText: {
    fontSize: 12,
    fontWeight: fontWeight.medium,
  },
  balance_positive: {
    color: '#10B981',
  },
  balance_negative: {
    color: '#EF4444',
  },
  balance_neutral: {
    color: colors.text.secondary,
  },
  emptyContainer: {
    ...cardBase,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  // Context Menu Styles (from Dashboard)
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  contextMenuOverlayTouchable: {
    flex: 1,
  },
  contextMenuContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.lg,
    elevation: 10,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  contextMenuHeader: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contextMenuTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  contextMenuItemText: {
    fontSize: fontSize.regular,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
  contextMenuItemCancel: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: spacing.sm,
  },
  contextMenuItemTextCancel: {
    fontSize: fontSize.regular,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },

  // Rename Modal Styles
  renameModalContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    margin: spacing.md,
    alignSelf: 'center',
    width: '90%',
    maxWidth: 400,
    elevation: 10,
    shadowColor: colors.black,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  renameModalTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  renameModalLabel: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  renameModalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 8,
    fontSize: fontSize.regular,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  renameModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  renameModalButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameModalCancelButton: {
    backgroundColor: '#F3F4F6',
  },
  renameModalSaveButton: {
    backgroundColor: colors.primary,
  },
  renameModalButtonText: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  // Overriding button text color for cancel
  renameModalCancelButton: {
    backgroundColor: '#E5E7EB',
  },
  renameModalButtonText: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  renameModalCancelButtonText: {
    fontSize: fontSize.medium,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },

  // Modal contact picker styles - prefixed to avoid conflicts
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)', // Darken background for all modals
    justifyContent: 'flex-end', // Align contact picker modal to bottom
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: { // This refers to the "Select Contact" modal itself
    width: '100%',
    maxHeight: '75%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.md,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.large,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  modalClose: {
    padding: 4,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  modalSearchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: fontSize.regular,
    color: colors.text.primary,
    paddingVertical: 4,
  },
  modalList: {
    paddingBottom: spacing.sm,
  },
  modalContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalContactAvatar: {
    marginRight: spacing.md,
  },
  modalContactDetails: {
    flex: 1,
    minWidth: 0,
  },
  contactRowDisabled: {
    opacity: 0.6,
  },
  contactAddedText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.text.secondary,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
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
  },
});

export default LedgerScreen;
