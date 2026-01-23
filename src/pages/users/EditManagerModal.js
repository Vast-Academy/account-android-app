import React, { useState, useEffect } from 'react';
import { FiSave } from 'react-icons/fi';
import SummaryApi from '../../common';
import Modal from '../../components/Modal';
import { useNotification } from '../../context/NotificationContext';

const EditManagerModal = ({ isOpen, onClose, managerId, onSuccess }) => {
  const { showNotification } = useNotification();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    phone: '',
    branch: '',
    status: 'active'
  });
  
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
const [passwordData, setPasswordData] = useState({
  newPassword: '',
  confirmPassword: ''
});
  
  useEffect(() => {
    if (isOpen && managerId) {
      fetchManager();
      fetchBranches();
    }
  }, [isOpen, managerId]);
  
  const fetchManager = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${SummaryApi.getUser.url}/${managerId}`, {
        method: SummaryApi.getUser.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Set form data from manager
        setFormData({
          firstName: data.data.firstName || '',
          lastName: data.data.lastName || '',
          username: data.data.username || '',
          email: data.data.email || '',
          phone: data.data.phone || '',
          branch: data.data.branch && data.data.branch._id ? data.data.branch._id : (data.data.branch || ''),
          status: data.data.status || 'active'
        });
      } else {
        setError(data.message || 'Failed to fetch manager data');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error fetching manager:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchBranches = async () => {
    try {
      const response = await fetch(SummaryApi.getBranches.url, {
        method: SummaryApi.getBranches.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setBranches(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const validateForm = () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.branch) {
      setError('Please fill in all required fields');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      // If password is empty, remove it from the request
      const dataToSend = {...formData};
      if (!dataToSend.password) {
        delete dataToSend.password;
      }
      
      const response = await fetch(`${SummaryApi.updateUser.url}/${managerId}`, {
        method: SummaryApi.updateUser.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend)
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification('success', 'Manager updated successfully');
        onSuccess && onSuccess();
        onClose();
      } else {
        setError(data.message || 'Failed to update manager');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error updating manager:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };
  
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      setError('Both password fields are required');
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      setLoading(true);
      
      // Admin can directly set new password
      const response = await fetch(`${SummaryApi.adminChangePassword.url}/${managerId}`, {
        method: SummaryApi.adminChangePassword.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword: passwordData.newPassword })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification('success', 'Password updated successfully');
        setPasswordData({ newPassword: '', confirmPassword: '' });
        setShowPasswordChange(false);
      } else {
        setError(data.message || 'Failed to update password');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error updating password:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Edit Manager"
      size="lg"
    >
      <div className="p-6">
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
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
                value={formData.firstName}
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
                value={formData.lastName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter last name"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="username">
                Username*
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                 className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter username"
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
                value={formData.email}
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
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter phone number"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="branch">
                Branch*
              </label>
              <select
                id="branch"
                name="branch"
                value={formData.branch}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="">Select Branch</option>
                {branches.map(branch => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 mr-2 hover:bg-gray-50"
            >
              Cancel
            </button>
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
  
  {!showPasswordChange ? (
    <button
      type="button"
      onClick={() => setShowPasswordChange(true)}
      className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
    >
      Change Password
    </button>
  ) : (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      
      <div className="flex space-x-3">
        <button
          type="button"
          onClick={handlePasswordSubmit}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Update Password
        </button>
        
        <button
          type="button"
          onClick={() => {
            setShowPasswordChange(false);
            setPasswordData({ newPassword: '', confirmPassword: '' });
          }}
          className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          Cancel
        </button>
      </div>
    </div>
  )}
</div>
      </div>
    </Modal>
  );
};

export default EditManagerModal;