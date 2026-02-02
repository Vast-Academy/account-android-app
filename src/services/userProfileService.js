import auth from '@react-native-firebase/auth';
import {cacheUserData, getCachedUser} from './chatDatabase';

// Backend API base URL
const API_URL = 'https://account-android-app-backend.vercel.app/api';

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
        phoneNumber: userData.phoneNumber || '',
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

    // Cache search results locally
    if (data.users && data.users.length > 0) {
      for (const user of data.users) {
        await cacheUserData(user);
      }
    }

    return data.users || [];
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
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
    return data.users || [];
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
  getUserByUsername,
  getUserById,
  updateFCMToken,
  updateUserProfile,
  checkUsernameAvailability,
  generateSearchTerms,
};
