import auth from '@react-native-firebase/auth';
import {cacheUserData, getCachedUser} from './chatDatabase';

// Backend API base URL
const API_URL = 'https://account-android-app-backend.vercel.app/api';

const normalizeUserResult = user => {
  if (!user) {
    return null;
  }
  const userId = user.userId || user.firebaseUid || user.id || user._id || '';
  const phoneNumber = user.phoneNumber || user.mobile || '';
  return {
    ...user,
    userId,
    phoneNumber,
  };
};

/**
 * Get Firebase auth token
 */
const getAuthToken = async () => {
  const currentUser = auth().currentUser;
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  return await currentUser.getIdToken();
};

/**
 * Generate searchable terms from user data
 */
const generateSearchTerms = (userData) => {
  const terms = [];

  // Username
  if (userData.username) {
    terms.push(userData.username.toLowerCase());
  }

  // Display name words
  if (userData.displayName) {
    const words = userData.displayName.toLowerCase().split(' ');
    terms.push(...words);
  }

  // Phone number (if visible)
  if (userData.phoneNumber) {
    terms.push(userData.phoneNumber);
    // Also add without country code for easier search
    const cleanPhone = userData.phoneNumber.replace(/^\+\d{1,3}/, ''); // Remove country code
    if (cleanPhone !== userData.phoneNumber) {
      terms.push(cleanPhone);
    }
  }

  // Remove duplicates
  return [...new Set(terms)];
};

/**
 * Sync user profile to MongoDB (via backend API)
 * This creates/updates the user's profile in the cloud for search purposes
 */
export const syncUserProfileToCloud = async (userData) => {
  try {
    const userId = auth().currentUser?.uid;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const searchableTerms = generateSearchTerms(userData);
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/users/sync-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId,
        username: userData.username?.toLowerCase() || '',
        displayName: userData.displayName || '',
        mobile: userData.phoneNumber || userData.mobile || '',
        email: userData.email || '',
        photoURL: userData.photoURL || '',
        searchableTerms,
        fcmToken: userData.fcmToken || '',
        privacy: userData.privacy || {
          phoneNumberVisible: true,
          lastSeenVisible: true,
          profilePhotoVisible: true,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to sync profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Error syncing profile to cloud:', error);
    throw error;
  }
};

/**
 * Search users globally (via backend API)
 * Searches MongoDB for users matching the query
 */
export const searchUsers = async (query, limit = 20) => {
  try {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = query.toLowerCase().trim();
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/users/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({query: searchTerm, limit}),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to search users');
    }

    const data = await response.json();

    const normalizedUsers = (data.users || []).map(normalizeUserResult).filter(Boolean);

    // Cache search results locally
    if (normalizedUsers.length > 0) {
      for (const user of normalizedUsers) {
        await cacheUserData(user);
      }
    }

    return normalizedUsers;
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
};

/**
 * Batch search users by phone numbers (WhatsApp-style)
 * Returns hash map: { "9876543210": userData, ... }
 */
export const batchSearchUsers = async (phoneNumbers) => {
  console.log('🔧 DEBUG [batchSearchUsers]: Function called!');
  console.log('🔧 DEBUG [batchSearchUsers]: Phone numbers:', phoneNumbers);
  console.log('🔧 DEBUG [batchSearchUsers]: Count:', phoneNumbers?.length);

  try {
    if (!phoneNumbers || phoneNumbers.length === 0) {
      console.log('⚠️ DEBUG [batchSearchUsers]: Empty phone numbers array, returning {}');
      return {};
    }

    console.log('🔧 DEBUG [batchSearchUsers]: Getting auth token...');
    const token = await getAuthToken();
    console.log('✅ DEBUG [batchSearchUsers]: Got auth token:', token ? `${token.substring(0, 20)}...` : 'null');

    const url = `${API_URL}/auth/users-by-phones`;
    console.log('🔧 DEBUG [batchSearchUsers]: API URL:', url);
    console.log('🔧 DEBUG [batchSearchUsers]: Full API_URL:', API_URL);

    const payload = { phones: phoneNumbers };
    console.log('📤 DEBUG [batchSearchUsers]: Payload:', JSON.stringify(payload));

    console.log('🔧 DEBUG [batchSearchUsers]: Making fetch call...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('📥 DEBUG [batchSearchUsers]: Response received!');
    console.log('🔧 DEBUG [batchSearchUsers]: Response status:', response.status);
    console.log('🔧 DEBUG [batchSearchUsers]: Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ DEBUG [batchSearchUsers]: Batch search failed!');
      console.error('   Status:', response.status);
      console.error('   Error:', errorText);
      return {};
    }

    const data = await response.json();
    console.log('✅ DEBUG [batchSearchUsers]: Response data:', data);
    console.log('🔧 DEBUG [batchSearchUsers]: Users found:', Object.keys(data.users || {}).length);

    return data.users || {};
  } catch (error) {
    console.error('❌ DEBUG [batchSearchUsers]: Error caught!');
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    console.error('   Full error:', error);
    return {};
  }
};

/**
 * Search users by phone number
 */
export const searchUsersByPhone = async (phoneNumber) => {
  try {
    if (!phoneNumber) {
      return [];
    }

    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/users/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: phoneNumber,
        searchType: 'phone',
        limit: 5,
      }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return (data.users || []).map(normalizeUserResult).filter(Boolean);
  } catch (error) {
    console.error('Error searching by phone:', error);
    return [];
  }
};

/**
 * Get user profile by username (via backend API)
 */
export const getUserByUsername = async (username) => {
  try {
    if (!username) {
      return null;
    }

    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/users/by-username/${username}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json();

    // Cache user data locally
    if (user) {
      await cacheUserData(user);
    }

    return user;
  } catch (error) {
    console.error('Error getting user by username:', error);
    return null;
  }
};

/**
 * Get user profile by userId (via backend API)
 */
export const getUserById = async (userId) => {
  try {
    if (!userId) {
      return null;
    }

    // Check local cache first
    const cachedUser = getCachedUser(userId);
    if (cachedUser) {
      // Return cached data (check if fresh - less than 1 hour old)
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      if (cachedUser.cached_at > oneHourAgo) {
        return cachedUser;
      }
    }

    // Fetch from backend
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/users/${userId}/profile`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return cachedUser || null; // Return stale cache if available
    }

    const data = await response.json();
    const user = data.user;

    // Cache user data locally
    if (user) {
      await cacheUserData(user);
    }

    return user;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    // Return cached data if available
    const cachedUser = getCachedUser(userId);
    return cachedUser || null;
  }
};

/**
 * Update FCM token for current user
 */
export const updateFCMToken = async (fcmToken) => {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/users/update-fcm-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({fcmToken}),
    });

    if (!response.ok) {
      throw new Error('Failed to update FCM token');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating FCM token:', error);
    throw error;
  }
};

/**
 * Update user profile (bio, privacy settings, etc.)
 */
export const updateUserProfile = async (updates) => {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/users/update-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update profile');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

/**
 * Check if username is available
 */
export const checkUsernameAvailability = async (username) => {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/users/check-username`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({username: username.toLowerCase()}),
    });

    const data = await response.json();
    return data.available || false;
  } catch (error) {
    console.error('Error checking username:', error);
    return false;
  }
};

export default {
  syncUserProfileToCloud,
  searchUsers,
  searchUsersByPhone,
  batchSearchUsers,
  getUserByUsername,
  getUserById,
  updateFCMToken,
  updateUserProfile,
  checkUsernameAvailability,
  generateSearchTerms,
};
