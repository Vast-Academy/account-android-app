import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiPlus, FiEdit2, FiUserCheck, FiUserX, FiLoader, FiSearch, FiUser } from 'react-icons/fi';
import SummaryApi from '../../common';
import AddManagerModal from './AddManagerModal';
import EditManagerModal from './EditManagerModal';

const ManagerUsers = () => {
  const [managers, setManagers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  // State to track which row is expanded
  const [expandedRow, setExpandedRow] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  // New state for edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  const navigate = useNavigate();
  
  // Cache staleness time - 15 minutes
  const CACHE_STALENESS_TIME = 15 * 60 * 1000;
  
  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async (forceFresh = false) => {
    try {
      // Check for cached data
      const cachedManagerData = localStorage.getItem('managerUsersData');
      const cachedBranchData = localStorage.getItem('managerBranchesData');
      
      // Use cached data if available and not forcing fresh data
      // (timestamp check को हटा दें)
      if (!forceFresh && cachedManagerData && cachedBranchData) {
        setManagers(JSON.parse(cachedManagerData));
        setBranches(JSON.parse(cachedBranchData));
        
        
        // Fetch fresh data in background
        fetchFreshDataInBackground();
        setLoading(false);
        return;
      }
      
      // If no valid cache or force fresh, fetch new data
      setLoading(true);
      await fetchFreshData();
    } catch (err) {
      // Try to use cached data as fallback if API fails
      const cachedManagerData = localStorage.getItem('managerUsersData');
      const cachedBranchData = localStorage.getItem('managerBranchesData');
      
      if (cachedManagerData && cachedBranchData) {
        setManagers(JSON.parse(cachedManagerData));
        setBranches(JSON.parse(cachedBranchData));
        console.log("Using cached manager data after fetch error");
      } else {
        setError('Server error. Please try again later.');
        console.error('Error fetching data:', err);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Function to fetch fresh data in background
  const fetchFreshDataInBackground = async () => {
    try {
      await fetchFreshData(true);
    } catch (err) {
      console.error('Error fetching manager data in background:', err);
    }
  };
  
  // Function to fetch fresh data directly from API
  const fetchFreshData = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    
    try {
      // Fetch branches first to populate dropdown
      const branchResponse = await fetch(SummaryApi.getBranches.url, {
        method: SummaryApi.getBranches.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const branchData = await branchResponse.json();
      
      if (branchData.success) {
        const branchesData = branchData.data || [];
        setBranches(branchesData);
        
        // Cache the branches data
        localStorage.setItem('managerBranchesData', JSON.stringify(branchesData));
      }
      
      // Fetch managers
      const managerResponse = await fetch(SummaryApi.getManagerUsers.url, {
        method: SummaryApi.getManagerUsers.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const managerData = await managerResponse.json();
      
      if (managerData.success) {
        const managersData = managerData.data || [];
        setManagers(managersData);
        
        // Cache the managers data
        localStorage.setItem('managerUsersData', JSON.stringify(managersData));
        // localStorage.setItem('managerUsersDataTimestamp', new Date().getTime().toString());
        
        // Update last refresh time
        setLastRefreshTime(new Date().getTime());
      } else {
        setError(managerData.message || 'Failed to fetch manager users');
      }
    } catch (err) {
      if (!isBackground) {
        setError('Server error. Please try again later.');
        console.error('Error fetching data:', err);
      }
      throw err;
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };
  
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };
  
  const handleBranchFilter = (e) => {
    setBranchFilter(e.target.value);
  };
  
  // Function to handle row click
  const handleRowClick = (managerId) => {
    // If the clicked row is already expanded, collapse it
    if (expandedRow === managerId) {
      setExpandedRow(null);
    } else {
      // Otherwise, expand the clicked row
      setExpandedRow(managerId);
    }
  };

  // Handle view details click
  const handleViewDetails = (managerId) => {
    navigate(`/users/managers/${managerId}`);
  };
  
  const filteredManagers = managers.filter(manager => {
    // Apply search term filter
    const matchesSearch = 
      manager.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manager.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Apply branch filter
    const matchesBranch = branchFilter === '' || manager.branch?._id === branchFilter;
    
    return matchesSearch && matchesBranch;
  });

  // New function to handle edit button click
  const handleEditManager = (managerId) => {
    setSelectedManagerId(managerId);
    setShowEditModal(true);
  };
  
  const handleStatusToggle = async (userId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      
      const response = await fetch(SummaryApi.updateUserStatus.url, {
        method: SummaryApi.updateUserStatus.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, status: newStatus })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update the local state to reflect the change
        const updatedManagers = managers.map(manager => 
          manager._id === userId ? { ...manager, status: newStatus } : manager
        );
        
        setManagers(updatedManagers);
        
        // Update cache with new manager data
        localStorage.setItem('managerUsersData', JSON.stringify(updatedManagers));
      } else {
        setError(data.message || 'Failed to update user status');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error updating user status:', err);
    }
  };
  
  // Handle successful manager addition or update
  const handleManagerSuccess = () => {
    // Clear the cache to force a fresh fetch
    localStorage.removeItem('managerUsersData');
    
    // Fetch fresh data
    fetchFreshData();
  };
  
  return (
    <div>
      <div className="p-6 bg-white rounded-lg shadow-md max-w-[1300px]">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-800">Manager Users</h1>
          
          <div className="flex items-center">
            <button 
              onClick={() => fetchFreshData()}
              className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 mr-3"
              title="Refresh Managers"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
            </button>

          </div>
        </div>

        <button
              onClick={() => setShowAddModal(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-full flex items-center"
            >
              <FiPlus className="mr-2" /> Add Manager
            </button>

        <div className="flex flex-col md:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search managers..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
          </div>
          
          <div className="md:w-64">
            <select
              value={branchFilter}
              onChange={handleBranchFilter}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>

      </div>
      
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="border-t">
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <FiLoader className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : filteredManagers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className='bg-gray-50'>
                <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      S.NO
                    </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredManagers.map((manager, index) => (
                  <React.Fragment key={manager._id}>
                    <tr 
                      className={`hover:bg-gray-50 cursor-pointer ${expandedRow === manager._id ? 'bg-gray-50' : ''}`}
                      onClick={() => handleRowClick(manager._id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-8 h-8 rounded-full bg-orange-600 flex items-center justify-center text-white font-medium">
                            {index + 1}
                          </div>
                        </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{manager.firstName} {manager.lastName}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {manager.username}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {manager.email}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {manager.phone || 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {manager.branch ? manager.branch.name : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          manager.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {manager.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                    
                    {/* Expanded row with action buttons */}
                    {expandedRow === manager._id && (
                      <tr>
                        <td colSpan="7" className="px-4 py-3 bg-gray-50 border-b">
                          <div className="flex space-x-4">
                            <button 
                              className="px-4 py-1.5 bg-orange-500 text-white rounded-md hover:bg-orange-600 flex items-center text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(manager._id);
                              }}
                            >
                              <FiUser className="mr-2" />
                              View Details
                            </button>

                            {/* New Edit button */}
                            <button 
                                className="px-4 py-1.5 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 flex items-center text-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditManager(manager._id);
                                }}
                              >
                                <FiEdit2 className="mr-2" />
                                Edit Details
                              </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No manager users found.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 inline-block bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-full"
            >
              Add Your First Manager
            </button>
          </div>
        )}
      </div>

      </div>

       {/* Add the modal component */}
       <AddManagerModal 
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleManagerSuccess}
      />

       {/* New Edit Manager Modal */}
       <EditManagerModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        managerId={selectedManagerId}
        onSuccess={handleManagerSuccess}
      />
    </div>
  );
};

export default ManagerUsers;