import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  FlatList,
  Platform,
  Modal,
  TextInput,
  Alert,
  Animated,
  DeviceEventEmitter,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons'; // For push-pin icon
import AsyncStorage from '@react-native-async-storage/async-storage';
import {colors, spacing, fontSize, fontWeight} from '../utils/theme';
import {useToast} from '../hooks/useToast';
import {useCurrencySymbol} from '../hooks/useCurrencySymbol';
import {queueBackupFromStorage} from '../utils/backupQueue';
import {
  initLedgerDatabase,
  getAllContactBalances,
  getLedgerStatistics,
  deleteContactAndTransactions,
  setContactName,
  getContactName,
  getLatestTransactionDateByContact,
  getDistinctContactRecordIds,
} from '../services/ledgerDatabase';

const CONTACTS_STORAGE_KEY = 'ledgerContacts';
const PINNED_CONTACT_IDS_STORAGE_KEY = 'pinnedLedgerContactIds';
const DEVICE_CONTACTS_CACHE_KEY = 'ledgerDeviceContacts';

const LedgerScreen = ({navigation}) => {
  const {showToast} = useToast();
  const currencySymbol = useCurrencySymbol();
  const [contacts, setContacts] = useState([]);
  const [contactsHydrated, setContactsHydrated] = useState(false);
  const [contactBalances, setContactBalances] = useState({});
  const [overallBalance, setOverallBalance] = useState({
    totalPaid: 0,
    totalGet: 0,
    netBalance: 0,
  });
  const [latestTransactionDates, setLatestTransactionDates] = useState({});
  const [dbContactIds, setDbContactIds] = useState([]);

  // For context menu
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [pinnedContactIds, setPinnedContactIds] = useState([]);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(300)).current;

  // For rename modal
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [renameContact, setRenameContact] = useState(null);
  const [originalContactName, setOriginalContactName] = useState('');

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('ledger:addContact', (contact) => {
      handleAddContact(contact);
    });
    return () => {
      sub.remove();
    };
  }, [handleAddContact]);


  useEffect(() => {
    const loadStoredData = async () => {
      try {
        initLedgerDatabase();
        const distinctIds = getDistinctContactRecordIds();
        setDbContactIds(distinctIds);

        // Load cached device contacts to help rebuild contact entries by recordID
        let cachedDeviceContacts = [];
        try {
          const cachedRaw = await AsyncStorage.getItem(DEVICE_CONTACTS_CACHE_KEY);
          const cachedParsed = cachedRaw ? JSON.parse(cachedRaw) : [];
          if (Array.isArray(cachedParsed)) {
            cachedDeviceContacts = cachedParsed;
          }
        } catch (cacheError) {
          console.error('Failed to load cached device contacts:', cacheError);
        }

        const stored = await AsyncStorage.getItem(CONTACTS_STORAGE_KEY);
        let storedContacts = [];
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            storedContacts = parsed;
          }
        }

        // Reconcile contacts from three sources:
        // 1) stored contacts, 2) cached device contacts, 3) DB transaction contact IDs
        const cachedById = new Map(
          cachedDeviceContacts.map(contact => [String(contact.recordID), contact]),
        );
        const storedById = new Map(
          storedContacts.map(contact => [String(contact.recordID), contact]),
        );

        const mergedIdSet = new Set([
          ...storedById.keys(),
          ...distinctIds.map(id => String(id)),
        ]);

        const reconciledContacts = Array.from(mergedIdSet).map(recordID => {
          const storedContact = storedById.get(recordID);
          if (storedContact) {
            return storedContact;
          }
          const cachedContact = cachedById.get(recordID);
          if (cachedContact) {
            return cachedContact;
          }
          return {
            recordID,
            displayName: 'Unknown Contact',
            givenName: '',
            familyName: '',
            phoneNumbers: [],
          };
        });

        // Fetch Names for reconciled contacts
        const contactsWithNames = await Promise.all(
          reconciledContacts.map(async contact => {
            const savedName = await getContactName(contact.recordID);
            if (savedName) {
              return {...contact, savedName};
            }
            const deviceName = getContactNameFromDevice(contact);
            if (deviceName) {
              await setContactName(contact.recordID, deviceName);
              return {...contact, savedName: deviceName};
            }
            return {...contact, savedName: null};
          }),
        );
        setContacts(contactsWithNames);
        const storedPinned = await AsyncStorage.getItem(PINNED_CONTACT_IDS_STORAGE_KEY);
        if (storedPinned) {
          const parsedPinned = JSON.parse(storedPinned);
          if (Array.isArray(parsedPinned)) {
            const reconciledIds = new Set(
              contactsWithNames.map(contact => String(contact.recordID)),
            );
            setPinnedContactIds(
              parsedPinned.filter(id => reconciledIds.has(String(id))),
            );
          } else {
            setPinnedContactIds([]);
          }
        }
      } catch (error) {
        console.error('Failed to load stored data:', error);
      } finally {
        setContactsHydrated(true);
      }
    };
    loadStoredData();
  }, []);




  const getContactDisplayName = useCallback(async (contact) => {
    const savedName = await getContactName(contact.recordID);
    if (savedName) {
        return savedName;
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
  
    // Fetch Names for current contacts to ensure display names are updated
    const contactsWithUpdatedNames = await Promise.all(
      baseContacts.map(async (contact) => {
        const savedName = await getContactName(contact.recordID);
        return { ...contact, savedName: savedName || null };
      })
    );
    setContacts(current =>
      sortContactsByPinned(contactsWithUpdatedNames, pinnedContactIds, latestDates)
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
            // Do not persist savedName, it's stored in DB
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
      const contactIdSet = new Set(contacts.map(c => String(c.recordID)));
      const missingDbIds = dbContactIds.filter(id => !contactIdSet.has(String(id)));
      const shouldSkipPersist =
        dbContactIds.length > 0 && (contacts.length === 0 || missingDbIds.length > 0);

      if (!shouldSkipPersist) {
        persistContacts();
      }
    }
  }, [contacts, contactsHydrated, dbContactIds]);

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




  const getContactNameFromDevice = contact => {
    const fullName = [contact.givenName, contact.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || contact.displayName || 'Unnamed Contact';
  };











  const handleAddContact = async contact => {
    const existingName = await getContactName(contact.recordID);
    const displayName = existingName || getContactNameFromDevice(contact);

    if (!existingName && displayName) {
      await setContactName(contact.recordID, displayName);
    }

    const contactWithName = { ...contact, savedName: displayName || null };

    setContacts(prev => {
      if (prev.some(item => item.recordID === contact.recordID)) {
        return prev;
      }
      const next = [...prev, contactWithName];
      return sortContactsByPinned(next, pinnedContactIds, latestTransactionDates);
    });
    showToast('Contact added successfully', 'success');
  };

  const formatCurrency = amount => {
    return `${currencySymbol}${Math.abs(amount).toLocaleString('en-IN')}`;
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
      `Are you sure you want to delete ${selectedContact.savedName || getContactNameFromDevice(selectedContact)} and all its transactions? This action cannot be undone.`,
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
    setRenameContact(selectedContact);
    const currentName = await getContactName(selectedContact.recordID);
    setNewName(currentName || getContactNameFromDevice(selectedContact));
    setRenameModalVisible(true);
    closeContextMenu(); // Close context menu when rename modal opens
  };

  const closeRenameModal = () => {
    setRenameModalVisible(false);
    setNewName('');
    setRenameContact(null);
  };

  const handleSaveName = async () => {
    if (!renameContact || !newName.trim()) {
      Alert.alert('Invalid Name', 'Name cannot be empty.');
      return;
    }
    try {
      await setContactName(renameContact.recordID, newName.trim());
      // Update the savedName in the local contacts state
      setContacts(prev => prev.map(c => 
        c.recordID === renameContact.recordID ? { ...c, savedName: newName.trim() } : c
      ));
      await loadBalances(); // Refresh balances and stats
      closeRenameModal();
      Alert.alert('Success', 'Contact renamed successfully.');
    } catch (error) {
      console.error('Failed to save name:', error);
      Alert.alert('Error', 'Failed to save name.');
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


  const renderContact = ({item, index}) => {
    const name = item.savedName || getContactNameFromDevice(item);
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
      <Pressable
        onPress={() => navigation.navigate('LedgerContactDetail', {contact: item})}
        onLongPress={() => openContextMenu(item)}
        android_ripple={{color: 'rgba(0,0,0,0.06)'}}
        style={({pressed}) => [
          styles.contactItem,
          index === contacts.length - 1 && styles.lastContactItem,
          pressed && styles.rowPressed,
        ]}>
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
      </Pressable>
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


      <Pressable onPress={() => navigation.navigate('LedgerAddContact')} android_ripple={{color: 'rgba(255,255,255,0.2)'}} style={({pressed}) => [styles.fab, pressed && styles.fabPressed]}>
        <Icon name="person-add" size={22} color={colors.white} />
      </Pressable>

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
            <Text style={styles.renameModalLabel}>Name</Text>
            <TextInput
              style={styles.renameModalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter new name"
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
                onPress={handleSaveName}>
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
    height: 0,
    marginBottom: 0,
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
  rowPressed: {
    backgroundColor: '#F1F5F9',
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
  fabPressed: {
    transform: [{scale: 0.98}],
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
});

export default LedgerScreen;



















