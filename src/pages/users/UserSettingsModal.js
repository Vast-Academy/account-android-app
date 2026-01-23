import React, { useState, useEffect } from 'react';
import { FiSave } from 'react-icons/fi';
import Modal from '../../components/Modal'; // आप अपने वर्तमान Modal कंपोनेंट का इस्तेमाल कर सकते हैं
import { useAuth } from '../../context/AuthContext';
import SummaryApi from '../../common';

const UserSettingsModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  
  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    username: ''
  });
  
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  

  useEffect(() => {
    if (isOpen && user && user._id) {
      fetchUserData();
    }
  }, [isOpen, user]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${SummaryApi.getUser.url}/${user._id}`, {
        method: SummaryApi.getUser.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setUserData({
          firstName: data.data.firstName || '',
          lastName: data.data.lastName || '',
          email: data.data.email || '',
          phone: data.data.phone || '',
          username: data.data.username || ''
        });
      } else {
        setError('Failed to load user information');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error fetching user data:', err);
    } finally {
      setLoading(false);
    }
  };


  const handleChange = (e) => {
    setUserData({
      ...userData,
      [e.target.name]: e.target.value
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    try {
      setLoading(true);
      
      const response = await fetch(`${SummaryApi.updateUser.url}/${user._id}`, {
        method: SummaryApi.updateUser.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Profile updated successfully');
        
        // अपडेट होने के बाद महत्वपूर्ण!
        // localStorage में user को अपडेट करें
        const updatedUser = { ...user, ...userData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // बदलाव प्रदर्शित करने के लिए UI को अपडेट करें
        window.location.reload(); // या बेहतर तरीका इस्तेमाल करें
      } else {
        setError(data.message || 'Failed to update profile');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error updating profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError('All password fields are required');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    
    try {
      setLoading(true);

      // केवल आवश्यक डेटा भेजें
    const passwordPayload = {
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword
    };
    
    console.log('Sending password data:', passwordPayload); // डीबग के लिए
      
      // यहां आपको अपना बैकएंड एंडपॉइंट जोड़ना होगा
      const response = await fetch(`${SummaryApi.changePassword.url}/${user._id}`, {
        method: SummaryApi.changePassword.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordPayload)
      });
      
      const data = await response.json();
      console.log('Password change response:', data);
      
      if (data.success) {
        setSuccess('Password changed successfully');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordFields(false);
      } else {
        setError(data.message || 'Failed to change password');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error changing password:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Account Settings"
      size="lg"
    >
      <div className="p-6">
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 text-green-700 p-3 rounded mb-4">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="firstName">
                First Name*
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={userData.firstName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter first name"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="lastName">
                Last Name*
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={userData.lastName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter last name"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="email">
                Email*
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={userData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter email"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="phone">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                value={userData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter phone number"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={userData.username}
                className="w-full px-3 py-2 border border-gray-200 bg-gray-100 text-gray-500 rounded-md cursor-not-allowed"
                placeholder="Enter username"
                disabled
                readOnly
              />
              <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <FiSave className="mr-2" /> Saving...
                </>
              ) : (
                <>
                  <FiSave className="mr-2" /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
        
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium mb-4">Change Password</h3>
          
          {!showPasswordFields ? (
            <button
              onClick={() => setShowPasswordFields(true)}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Change Password
            </button>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
    <div>
      <label className="block text-gray-700 mb-2" htmlFor="currentPassword">
        Current Password*
      </label>
      <input
        id="currentPassword"
        name="currentPassword"
        type="password"
        value={passwordData.currentPassword}
        onChange={handlePasswordChange}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        required
      />
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
      <div>
        <label className="block text-gray-700 mb-2" htmlFor="newPassword">
          New Password*
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          value={passwordData.newPassword}
          onChange={handlePasswordChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
      
      <div>
        <label className="block text-gray-700 mb-2" htmlFor="confirmPassword">
          Confirm New Password*
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={passwordData.confirmPassword}
          onChange={handlePasswordChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          required
        />
      </div>
    </div>
    
    <div className="flex space-x-3 mt-4">
      <button
        type="submit"
        disabled={loading}
        className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center ${
          loading ? 'opacity-70 cursor-not-allowed' : ''
        }`}
      >
        Update Password
      </button>
      
      <button
        type="button"
        onClick={() => {
          setShowPasswordFields(false);
          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        }}
        className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
      >
        Cancel
      </button>
    </div>
  </form>
)}
        </div>
      </div>
    </Modal>
  );
};

export default UserSettingsModal;