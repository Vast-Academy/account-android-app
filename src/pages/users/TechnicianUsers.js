import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEdit, FiTrash2, FiPlus, FiSearch, FiUser, FiPackage, FiList } from 'react-icons/fi';
import SummaryApi from '../../common';
import { useAuth } from '../../context/AuthContext';
import AddTechnicianModal from '../../components/AddTechnicianModal'; // Updated import path
import AssignInventoryModal from '../inventory/AssignInventoryModal';
import UnifiedInventoryAssignmentModal from '../inventory/UnifiedInventoryAssignmentModal';
import TechnicianDetailModal from '../technician/TechnicianDetailModal';
import TechnicianInventoryModal from './TechnicianInventoryModal';

const TechnicianUsers = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(null);
  
  // States for expanded rows and inventory assignment
  const [expandedTechnician, setExpandedTechnician] = useState(null);
  const [showAssignInventoryModal, setShowAssignInventoryModal] = useState(false);
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  
  // New state for technician inventory modal
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [selectedTechnicianForInventory, setSelectedTechnicianForInventory] = useState(null);
  
  // Last refresh time tracking
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  
  // Cache staleness time - 15 minutes
  const CACHE_STALENESS_TIME = 15 * 60 * 1000;

  const handleRowClick = (technicianId) => {
    setExpandedTechnician(expandedTechnician === technicianId ? null : technicianId);
  };
  
  const fetchTechnicians = async (forceFresh = false) => {
    try {
      // Check for cached data
      const cachedTechnicians = localStorage.getItem('technicianUsersData');
      
      // Use cached data if available and not forcing fresh data
      // (timestamp check को हटा दें)
      if (!forceFresh && cachedTechnicians) {
        setTechnicians(JSON.parse(cachedTechnicians));
        
        // Fetch fresh data in background
        fetchFreshTechniciansInBackground();
        setLoading(false);
        return;
      }
      
      // If no valid cache or force fresh, fetch new data
      setLoading(true);
      await fetchFreshTechnicians();
    } catch (err) {
      // Try to use cached data as fallback if API fails
      const cachedTechnicians = localStorage.getItem('technicianUsersData');
      
      if (cachedTechnicians) {
        setTechnicians(JSON.parse(cachedTechnicians));
        console.log("Using cached technician data after fetch error");
      } else {
        setError('Server error. Please try again later.');
        console.error('Error fetching technicians:', err);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Function to fetch fresh data in background
  const fetchFreshTechniciansInBackground = async () => {
    try {
      await fetchFreshTechnicians(true);
    } catch (err) {
      console.error('Error fetching technician data in background:', err);
    }
  };
  
  // Function to fetch fresh data directly from API
  const fetchFreshTechnicians = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    
    try {
      // We'll use different endpoints based on user role
      const endpoint = user.role === 'admin' 
        ? SummaryApi.getTechnicianUsers.url 
        : SummaryApi.getManagerTechnician.url;
      
      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        const techniciansData = data.data || [];
        setTechnicians(techniciansData);
        
        // Cache the technicians data
        localStorage.setItem('technicianUsersData', JSON.stringify(techniciansData));
        
        // Update last refresh time
        setLastRefreshTime(new Date().getTime());
      } else {
        setError('Failed to fetch technicians');
      }
    } catch (err) {
      if (!isBackground) {
        setError('Server error. Please try again later.');
        console.error('Error fetching technicians:', err);
      }
      throw err;
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };
  
  useEffect(() => {
    fetchTechnicians();
  }, [user.role]);
  
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };
  
  const filteredTechnicians = technicians.filter(tech => {
    const fullName = `${tech.firstName} ${tech.lastName}`.toLowerCase();
    const term = searchTerm.toLowerCase();
    
    return (
      fullName.includes(term) ||
      tech.username.toLowerCase().includes(term) ||
      tech.email.toLowerCase().includes(term) ||
      (tech.branch && typeof tech.branch === 'object' && tech.branch.name.toLowerCase().includes(term))
    );
  });
  
  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this technician?')) {
      return;
    }
    
    try {
      const response = await fetch(`${SummaryApi.deleteUser.url}/${userId}`, {
        method: SummaryApi.deleteUser.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Invalidate cache
        localStorage.removeItem('technicianUsersData');
        
        // Update technicians list
        fetchFreshTechnicians();
      } else {
        setError(data.message || 'Failed to delete technician');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error deleting technician:', err);
    }
  };
  
  const handleViewDetails = (technicianId) => {
    setSelectedTechnicianId(technicianId);
    setShowDetailModal(true);
  };
  
  const handleAssignInventory = (technician) => {
    setSelectedTechnician(technician);
    setShowAssignInventoryModal(true);
  };
  
  // New handler for viewing inventory
  const handleViewInventory = (technician) => {
    setSelectedTechnicianForInventory(technician);
    setShowInventoryModal(true);
  };
  
  // Handle successful technician addition
  const handleTechnicianSuccess = () => {
    // Clear the cache to force a fresh fetch
    localStorage.removeItem('technicianUsersData');
    
    // Fetch fresh data
    fetchFreshTechnicians();
  };
  
  return (
    <div className="">
      {/* Main Container with White Box */}
      <div className="p-6 bg-white rounded-lg shadow-md max-w-[1300px]">
        {/* Header */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-semibold text-gray-800">User Management</h1>
            
            <div className="flex items-center">
              <button 
                onClick={() => fetchFreshTechnicians()}
                className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 mr-3"
                title="Refresh Technicians"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
              </button>
          
            </div>
          </div>

          {/* Add Technician button - uses modal for both admin and manager */}
          <button
                onClick={() => setModalOpen(true)}
                className="px-4 py-2 bg-pink-600 text-white rounded-full hover:bg-pink-700 flex items-center whitespace-nowrap"
              >
                <FiPlus className="mr-2" /> Add Technician
              </button>
          
          {/* Search bar */}
          <div className="relative flex-grow mt-4">
            <input
              type="text"
              placeholder="Search technicians..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <FiSearch className="text-gray-400" />
            </div>
          </div>
        </div>
        
        {error && (
          <div className="mx-4 mb-4 bg-red-100 text-red-700 p-3 rounded">
            {error}
          </div>
        )}
        
        {/* Technicians table */}
        <div className="border-t">
          {loading ? (
            <div className="p-4 text-center">Loading technicians...</div>
          ) : technicians.length === 0 ? (
            <div className="p-4 text-center">No technicians found</div>
          ) : filteredTechnicians.length === 0 ? (
            <div className="p-4 text-center">No technicians match your search</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      S.NO
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      NAME
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      USERNAME
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      BRANCH
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      STATUS
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTechnicians.map((technician, index) => (
                    <React.Fragment key={technician._id}>
                      <tr 
                        className={`hover:bg-gray-50 cursor-pointer ${
                          expandedTechnician === technician._id ? 'bg-gray-50' : ''
                        }`}
                        onClick={() => handleRowClick(technician._id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center text-white font-medium">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="">
                              <div className="text-sm font-medium text-gray-900">
                                {technician.firstName} {technician.lastName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{technician.username}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {technician.branch && typeof technician.branch === 'object' 
                              ? technician.branch.name 
                              : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span 
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              technician.status === 'active' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {technician.status}
                          </span>
                        </td>
                      </tr>
                      
                      {/* Expanded row with action buttons */}
                      {expandedTechnician === technician._id && (
                        <tr>
                          <td colSpan="5" className="px-6 py-4 bg-gray-50 border-b">
                            <div className="flex space-x-4">
                              <button 
                                className="px-4 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center text-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(technician._id);
                                }}
                              >
                                <FiUser className="mr-2" />
                                View Details
                              </button>
                              
                              {user.role === 'manager' && (
                                <>
                                  <button 
                                    className="px-4 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center text-sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAssignInventory(technician);
                                    }}
                                  >
                                    <FiPackage className="mr-2" />
                                    Assign Inventory
                                  </button>
                                  
                                  {/* View Inventory button */}
                                  <button 
                                    className="px-4 py-1.5 bg-purple-500 text-white rounded-md hover:bg-purple-600 flex items-center text-sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewInventory(technician);
                                    }}
                                  >
                                    <FiList className="mr-2" />
                                    View Inventory
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add the TechnicianDetailModal */}
      <TechnicianDetailModal 
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        technicianId={selectedTechnicianId}
        onTechnicianUpdated={() => {
          // Invalidate cache
          localStorage.removeItem('technicianUsersData');
          fetchFreshTechnicians();
        }}
      />
      
      {/* Add Technician Modal for both admin and managers */}
      <AddTechnicianModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onSuccess={handleTechnicianSuccess}
      />
      
      {/* Assign Inventory Modal */}
      {selectedTechnician && (
        <UnifiedInventoryAssignmentModal
          isOpen={showAssignInventoryModal}
          onClose={() => setShowAssignInventoryModal(false)}
          technician={selectedTechnician}
          onSuccess={() => {
            // Refresh the technicians list after successful assignment
            fetchFreshTechnicians();
          }}
        />
      )}
      
      {/* Technician Inventory Modal */}
      {selectedTechnicianForInventory && (
        <TechnicianInventoryModal
          isOpen={showInventoryModal}
          onClose={() => setShowInventoryModal(false)}
          technician={selectedTechnicianForInventory}
        />
      )}
    </div>
  );
};

export default TechnicianUsers;