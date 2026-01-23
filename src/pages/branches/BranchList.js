import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiLoader, FiSearch, FiX, FiSave } from 'react-icons/fi';
import SummaryApi from '../../common';

const BranchList = () => {
  const [branches, setBranches] = useState([]);
  const [branchData, setBranchData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    address: '',
    phone: '',
    status: 'active'
  });
  const [formError, setFormError] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  
  // Cache staleness time - 15 minutes
  // const CACHE_STALENESS_TIME = 15 * 60 * 1000;
  
  useEffect(() => {
    fetchBranchesWithData();
  }, []);
  
  const fetchBranchesWithData = async (forceFresh = false) => {
    try {
      // Check for cached data
      const cachedBranchesData = localStorage.getItem('branchesWithData');
      
      // Use cached data if it's valid and not forcing fresh data
      if (!forceFresh && cachedBranchesData) {
        const parsedData = JSON.parse(cachedBranchesData);
        setBranches(parsedData.branches || []);
        setBranchData(parsedData.branchData || {});
        
        // console.log("Using cached branches data");
        
        // Fetch fresh data in background
        fetchFreshBranchesInBackground();
        setLoading(false);
        return;
      }
      
      // If no valid cache or force fresh, fetch new data
      setLoading(true);
      await fetchFreshBranchesData();
      
    } catch (err) {
      // Try to use cached data as fallback if API fails
      const cachedBranchesData = localStorage.getItem('branchesWithData');
      if (cachedBranchesData) {
        const parsedData = JSON.parse(cachedBranchesData);
        setBranches(parsedData.branches || []);
        setBranchData(parsedData.branchData || {});
        console.log("Using cached branches data after fetch error");
      } else {
        setError('Server error. Please try again later.');
        console.error('Error fetching branch data:', err);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Function to fetch fresh branches data in background
  const fetchFreshBranchesInBackground = async () => {
    try {
      await fetchFreshBranchesData(true);
      // console.log("Branches data updated in background");
    } catch (err) {
      console.error('Error fetching branches data in background:', err);
    }
  };
  
  // Function to fetch fresh branches data directly from API
  const fetchFreshBranchesData = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    
    try {
      // 1. Fetch all branches
      const branchResponse = await fetch(SummaryApi.getBranches.url, {
        method: SummaryApi.getBranches.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const branchData = await branchResponse.json();
      
      if (!branchData.success) {
        throw new Error(branchData.message || 'Failed to fetch branches');
      }
      
      const allBranches = branchData.data || [];
      
      // Initialize branch data with default values
      const tempBranchData = {};
      allBranches.forEach(branch => {
        tempBranchData[branch._id] = {
          manager: 'None',
          techniciansCount: 0,
          customersCount: 0,
          projectsCount: 0
        };
      });
      
      // 2. Try to fetch managers if endpoint exists
      if (SummaryApi.getManagerUsers) {
        try {
          const managersResponse = await fetch(SummaryApi.getManagerUsers.url, {
            method: SummaryApi.getManagerUsers.method,
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          const managersData = await managersResponse.json();
          
          if (managersData.success) {
            const managers = managersData.data || [];
            
            // Update branch data with managers
            allBranches.forEach(branch => {
              // Convert IDs to strings for safer comparison
              const branchId = branch._id.toString();
              
              const branchManager = managers.find(m => {
                // Safely check if branch exists and convert IDs to strings
                const managerBranchId = m.branch && typeof m.branch._id === 'object' 
                  ? m.branch._id.toString() 
                  : (m.branch && m.branch._id);
                  
                return managerBranchId === branchId && m.status === 'active';
              });
              
              if (branchManager) {
                tempBranchData[branchId] = {
                  ...tempBranchData[branchId],
                  manager: `${branchManager.firstName} ${branchManager.lastName}`
                };
              }
            });
          }
        } catch (err) {
          console.log('Could not fetch managers:', err);
        }
      }
      
      // 3. Try to fetch technicians if endpoint exists
      if (SummaryApi.getTechnicianUsers) {
        try {
          const techniciansResponse = await fetch(SummaryApi.getTechnicianUsers.url, {
            method: SummaryApi.getTechnicianUsers.method,
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          const techniciansData = await techniciansResponse.json();
          if (techniciansData.success) {
            const technicians = techniciansData.data || [];
            
            // Update branch data with technician counts
            allBranches.forEach(branch => {
              const branchTechnicians = technicians.filter(t => 
                t.branch && t.branch._id === branch._id && t.status === 'active'
              );
              
              if (tempBranchData[branch._id]) {
                tempBranchData[branch._id].techniciansCount = branchTechnicians.length;
              }
            });
          }
        } catch (err) {
          console.log('Could not fetch technicians:', err);
          // Continue without technicians data
        }
      }
      
      // 4. Try to fetch customers if endpoint exists
      if (SummaryApi.getAllCustomers) {
        try {
          const customersResponse = await fetch(SummaryApi.getAllCustomers.url, {
            method: SummaryApi.getAllCustomers.method,
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          const customersData = await customersResponse.json();
          if (customersData.success) {
            const customers = customersData.data || [];
            
            // Update branch data with customer counts
            allBranches.forEach(branch => {
              const branchCustomers = customers.filter(c => 
                c.branch && c.branch._id === branch._id
              );
              
              if (tempBranchData[branch._id]) {
                tempBranchData[branch._id].customersCount = branchCustomers.length;
              }
            });
          }
        } catch (err) {
          console.log('Could not fetch customers:', err);
          // Continue without customers data
        }
      }
      
      // 5. Try to fetch projects from manager projects API
      if (SummaryApi.getManagerProjects) {
        try {
          const projectsResponse = await fetch(SummaryApi.getManagerProjects.url, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          const projectsData = await projectsResponse.json();
          if (projectsData.success) {
            const projects = projectsData.data || [];
            
            // Update branch data with project counts
            allBranches.forEach(branch => {
              // Count projects for this branch (completed ones)
              const branchProjects = projects.filter(p => 
                p.branch && p.branch._id === branch._id && p.status === 'completed'
              );
              
              if (tempBranchData[branch._id]) {
                tempBranchData[branch._id].projectsCount = branchProjects.length;
              }
            });
          }
        } catch (err) {
          console.log('Could not fetch projects:', err);
          // Continue without projects data
        }
      }
      
      // Set the state with all gathered data
      setBranches(allBranches);
      setBranchData(tempBranchData);
      
      // Cache the complete data
      const branchesWithData = {
        branches: allBranches,
        branchData: tempBranchData
      };
      
      localStorage.setItem('branchesWithData', JSON.stringify(branchesWithData));
      // localStorage.setItem('branchesWithDataTimestamp', new Date().getTime().toString());
      
      // Update last refresh time
      setLastRefreshTime(new Date().getTime());
      
    } catch (err) {
      if (!isBackground) {
        setError('Server error. Please try again later.');
        console.error('Error fetching branch data:', err);
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
  
  const filteredBranches = branches.filter(branch => 
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.location.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const openModal = () => {
    setIsModalOpen(true);
    // Reset form data and errors
    setFormData({
      name: '',
      location: '',
      address: '',
      phone: '',
      status: 'active'
    });
    setFormError(null);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
  };
  
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    
    // Validate form
    if (!formData.name || !formData.location) {
      setFormError('Branch name and location are required');
      return;
    }
    
    try {
      setFormLoading(true);
      
      const response = await fetch(SummaryApi.addBranch.url, {
        method: SummaryApi.addBranch.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Close modal
        closeModal();
        
        // Invalidate the cache
        localStorage.removeItem('branchesWithData');
        localStorage.removeItem('branchesWithDataTimestamp');
        
        // Fetch fresh branch data
        fetchFreshBranchesData();
      } else {
        setFormError(data.message || 'Failed to add branch');
      }
    } catch (err) {
      setFormError('Server error. Please try again later.');
      console.error('Error adding branch:', err);
    } finally {
      setFormLoading(false);
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Branches</h1>
        <div className="flex items-center">
          <button 
            onClick={() => fetchFreshBranchesData()}
            className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 mr-3"
            title="Refresh Branches"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          </button>
          <button
            onClick={openModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md flex items-center"
          >
            <FiPlus className="mr-2" /> Add Branch
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Search Bar */}
      {/* <div className="mb-4 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search branches by name or location..."
          className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={searchTerm}
          onChange={handleSearch}
        />
      </div> */}
      
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <FiLoader className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : filteredBranches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredBranches.map((branch) => (
            <Link 
            key={branch._id}
            to={`/branches/${branch._id}`} 
            className='cursor-pointer'>
            <div key={branch._id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-5 border-b">
                <h2 className="text-xl font-semibold text-gray-800">{branch.name}</h2>
              </div>
              
              <div className="p-5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Manager</p>
                  <p className="text-base font-medium">
                    {branchData[branch._id]?.manager || 'None'}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Technicians</p>
                  <p className="text-base font-medium">
                    {branchData[branch._id]?.techniciansCount || 0}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Customers</p>
                  <p className="text-base font-medium">
                    {branchData[branch._id]?.customersCount || 0}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500">Projects</p>
                  <p className="text-base font-medium">
                    {branchData[branch._id]?.projectsCount || 0}
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 text-center">
                <div 
                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  Click to view details
                </div>
              </div>
            </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-white rounded-lg shadow-md">
          <p className="text-gray-500">No branches found.</p>
          <button
            onClick={openModal}
            className="mt-4 inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md"
          >
            Add Your First Branch
          </button>
        </div>
      )}
      
      {/* Add Branch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">Add New Branch</h2>
              <button 
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            
            {formError && (
              <div className="bg-red-100 text-red-700 p-3 mx-6 mt-4 rounded">
                {formError}
              </div>
            )}
            
            <div className="p-6">
              <form onSubmit={handleFormSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-700 mb-2" htmlFor="name">
                      Branch Name*
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter branch name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-gray-700 mb-2" htmlFor="location">
                      Location*
                    </label>
                    <input
                      id="location"
                      name="location"
                      type="text"
                      value={formData.location}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter location"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-gray-700 mb-2" htmlFor="address">
                      Address
                    </label>
                    <textarea
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter complete address"
                      rows="3"
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
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter phone number"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-gray-700 mb-2" htmlFor="status">
                      Status
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleFormChange}
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
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 mr-2 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center ${
                      formLoading ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {formLoading ? (
                      <>
                        <FiSave className="mr-2" /> Saving...
                      </>
                    ) : (
                      <>
                        <FiSave className="mr-2" /> Save Branch
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchList;