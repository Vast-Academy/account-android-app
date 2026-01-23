import React, { useState, useEffect } from 'react';
import { FiSearch, FiUser } from 'react-icons/fi';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import AssignTechnicianModal from './AssignTechnicianModal';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
};

const rowBackgroundColors = {
  pending: 'bg-yellow-50',
};

const WorkOrdersPage = () => {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOrders, setFilteredOrders] = useState([]);
  
  // State for filters
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all', 'installation', 'repair'
  
  // State for assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  
  const fetchWorkOrders = async (forceFresh = false) => {
    try {
      // Check for cached data
      const cachedWorkOrders = localStorage.getItem('workOrdersData');
      
      // Use cached data if available and not forcing fresh data
      if (!forceFresh && cachedWorkOrders) {
        const parsedWorkOrders = JSON.parse(cachedWorkOrders);
        setWorkOrders(parsedWorkOrders);
        applyFilters(parsedWorkOrders, categoryFilter);
        // console.log("Using cached work orders data");
        
        // Fetch fresh data in background
        fetchFreshWorkOrdersInBackground();
        setLoading(false);
        return;
      }
      
      // If no valid cache or force fresh, fetch new data
      setLoading(true);
      await fetchFreshWorkOrders();
    } catch (err) {
      // Try to use cached data as fallback if API fails
      const cachedWorkOrders = localStorage.getItem('workOrdersData');
      
      if (cachedWorkOrders) {
        const parsedWorkOrders = JSON.parse(cachedWorkOrders);
        setWorkOrders(parsedWorkOrders);
        applyFilters(parsedWorkOrders, categoryFilter);
        console.log("Using cached work orders data after fetch error");
      } else {
        setError('Server error. Please try again later.');
        console.error('Error fetching work orders:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch fresh data in background
const fetchFreshWorkOrdersInBackground = async () => {
  try {
    await fetchFreshWorkOrders(true);
  } catch (err) {
    console.error('Error fetching work orders in background:', err);
  }
};

// Function to fetch fresh data directly from API
const fetchFreshWorkOrders = async (isBackground = false) => {
  if (!isBackground) {
    setLoading(true);
    setError(null);
  }
  
  try {
    // Include branch parameter if admin has selected a branch
    let branchParam = '';
    if (user.role === 'admin' && user.selectedBranch) {
      branchParam = `?branch=${user.selectedBranch}`;
    }
    
    // Always filter for pending status only
    const statusParam = branchParam ? '&' : '?';
    branchParam += `${statusParam}status=pending`;
    
    const response = await fetch(`${SummaryApi.getWorkOrders.url}${branchParam}`, {
      method: SummaryApi.getWorkOrders.method,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Only keep pending orders
      const pendingOrders = data.data.filter(order => 
        order.status === 'pending' || 
        order.status === 'Pending'
      );
      
      setWorkOrders(pendingOrders);
      if (!isBackground) {
        applyFilters(pendingOrders, categoryFilter);
      }
      
      // Cache the work orders
      localStorage.setItem('workOrdersData', JSON.stringify(pendingOrders));
      
      // Update last refresh time
      setLastRefreshTime(new Date().getTime());
    } else {
      if (!isBackground) {
        setError(data.message || 'Failed to fetch work orders');
      }
    }
  } catch (err) {
    if (!isBackground) {
      setError('Server error. Please try again later.');
      console.error('Error fetching work orders:', err);
    }
    throw err;
  } finally {
    if (!isBackground) {
      setLoading(false);
    }
  }
};
  
  useEffect(() => {
    fetchWorkOrders();
  }, [user.selectedBranch]);
  
  const handleRowClick = (orderId) => {
    setExpandedRow(expandedRow === orderId ? null : orderId);
  };
  
  const handleAssignTechnician = (order) => {
    console.log("Assigning order:", order);
    setSelectedOrder(order);
    setShowAssignModal(true);
  };
  
  const handleAssignmentSuccess = (updatedOrder) => {
    // Remove the assigned order from the current list
    const updatedOrders = workOrders.filter(order => 
      !(order.orderId === updatedOrder.orderId && order.customerId === updatedOrder.customerId)
    );
    
    setWorkOrders(updatedOrders);
    
    // Apply filters again to update the filtered list
    applyFilters(updatedOrders, categoryFilter);
    
    // Update localStorage with the new orders list
    localStorage.setItem('workOrdersData', JSON.stringify(updatedOrders));
    
    // Close modal
    setShowAssignModal(false);
    
    // Fetch fresh data to ensure everything is up-to-date
    fetchFreshWorkOrders();
  };
  
  // Apply filters and search to the work orders
  const applyFilters = (ordersToFilter, category) => {
    let filtered = [...ordersToFilter];
    
    // Apply category filter
    if (category !== 'all') {
      if (category === 'installation') {
        filtered = filtered.filter(order => 
          order.projectCategory === 'New Installation' || !order.projectCategory
        );
      } else if (category === 'repair') {
        filtered = filtered.filter(order => 
          order.projectCategory === 'Repair'
        );
      }
    }
    
    // Apply search query
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(order => 
        (order.customerName && order.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.customerPhone && order.customerPhone.includes(searchQuery)) ||
        (order.orderId && order.orderId.includes(searchQuery)) ||
        (order.projectId && order.projectId.includes(searchQuery)) ||
        (order.projectType && order.projectType.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    setFilteredOrders(filtered);
  };
  
  // Handle filter change
  const handleFilterChange = (category) => {
    setCategoryFilter(category);
    applyFilters(workOrders, category);
  };
  
  // Handle search
  useEffect(() => {
    applyFilters(workOrders, categoryFilter);
  }, [searchQuery, workOrders]);
  
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="">
      {/* Main Container with White Box */}
      <div className="p-6 bg-white rounded-lg shadow-md max-w-[1300px]">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-gray-800">Pending Work Orders</h1>
        </div>
        
        {/* Filter Buttons */}
        <div className="mb-4">
          <div className="flex space-x-2">
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-1.5 rounded-full text-sm ${
                categoryFilter === 'all' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleFilterChange('installation')}
              className={`px-4 py-1.5 rounded-full text-sm ${
                categoryFilter === 'installation' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              New Installations
            </button>
            <button
              onClick={() => handleFilterChange('repair')}
              className={`px-4 py-1.5 rounded-full text-sm ${
                categoryFilter === 'repair' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Complaints
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="py-2 mb-4">
          <div className="relative flex-grow">
            <input
              type="text"
              placeholder="Search by customer name, phone, or order ID..."
              className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        
        {error && (
          <div className="mx-4 mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        {/* Work Orders Table */}
        <div className="border-t">
          {filteredOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.NO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CUSTOMER</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PROJECT TYPE</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CATEGORY</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DATE CREATED</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STATUS</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TECHNICIAN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredOrders.map((order, index) => (
                    <React.Fragment key={`${order.customerId}-${order.orderId}`}>
                      <tr 
                        className={`cursor-pointer hover:bg-gray-50 ${
                          expandedRow === `${order.customerId}-${order.orderId}` 
                            ? 'bg-gray-50' 
                            : order.projectCategory === 'Repair' 
                              ? 'bg-orange-50' 
                              : 'bg-yellow-50'
                        }`}
                        onClick={() => handleRowClick(`${order.customerId}-${order.orderId}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium ${
                            order.projectCategory === 'Repair' ? 'bg-orange-500' : 'bg-yellow-500'
                          }`}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{order.customerName}</div>
                          <div className="text-xs text-gray-400">{order.orderId}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                            {order.projectType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            order.projectCategory === 'Repair' 
                              ? 'bg-orange-100 text-orange-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {order.projectCategory === 'Repair' ? 'Complaint' : 'New Installation'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 rounded-full text-xs capitalize bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="text-yellow-600">Not Assigned</span>
                        </td>
                      </tr>
                      
                      {/* Expanded row */}
                      {expandedRow === `${order.customerId}-${order.orderId}` && (
                        <tr>
                          <td colSpan="7" className="px-6 py-4 bg-gray-50 border-b">
                            <div className="space-y-4">
                               {/* Check if this was a transferred project */}
        {order.statusHistory && order.statusHistory.some(history => history.status === 'transferring') && (
          <div className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
            <h4 className="font-semibold text-red-700">Transferred Project</h4>
            <p className="mt-1 text-gray-700">
              {order.statusHistory.find(history => history.status === 'transferring')?.remark || 'No transfer reason provided'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Transfer accepted by manager: {
                order.statusHistory.find(history => 
                  history.status === 'pending' && 
                  order.statusHistory.some(h => h.status === 'transferring')
                )?.remark || 'No transfer acceptance note provided'
              }
            </p>
          </div>
        )}
        
                              {/* Technical details / Remarks */}
                              {order.initialRemark && (
                                <div>
                                  <h4 className="font-semibold">
                                    {order.projectCategory === 'Repair' 
                                      ? 'Complaint Details:' 
                                      : 'Initial Requirements:'}
                                  </h4>
                                  <p className="mt-1 text-gray-600">{order.initialRemark}</p>
                                </div>
                              )}
                              
                              {/* Assignment button */}
                              <div className="flex">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAssignTechnician(order);
                                  }}
                                  className="inline-flex items-center px-4 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600"
                                >
                                  <FiUser className="mr-2" />
                                  Assign Technician
                                </button>
                              </div>
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
            <div className="p-8 text-center">
              {searchQuery && (
                <div>
                  <p className="text-gray-500 mb-4">
                    No pending work orders found matching "{searchQuery}"
                  </p>
                </div>
              )}
              {!searchQuery && categoryFilter !== 'all' && (
                <p className="text-gray-500">
                  No pending {categoryFilter === 'repair' ? 'complaints' : 'new installation work orders'} found.
                </p>
              )}
              {!searchQuery && categoryFilter === 'all' && (
                <p className="text-gray-500">
                  {workOrders.length > 0 ? 'No pending work orders found.' : 'No pending work orders found. Create a work order from the customer details page.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Assign Technician Modal */}
      <AssignTechnicianModal 
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        workOrder={selectedOrder}
        onSuccess={handleAssignmentSuccess}
      />
    </div>
  );
};

export default WorkOrdersPage;