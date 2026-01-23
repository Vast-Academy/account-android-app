import React, { useState, useEffect } from 'react';
import { FiChevronDown, FiChevronUp, FiClock, FiUser, FiPackage } from 'react-icons/fi';
import SummaryApi from '../../common';
import { useNotification } from '../../context/NotificationContext';
import ConfirmReturnModal from './ConfirmReturnModal';

const ReturnedInventoryTable = () => {
  const { showNotification } = useNotification();
  const [returnedItems, setReturnedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

  // Fetch returned inventory
  useEffect(() => {
    fetchReturnedInventory();
  }, []);

  const fetchReturnedInventory = async (forceFresh = false) => {
    try {
      // Check for cached data
      const cachedReturnedItems = localStorage.getItem('returnedInventoryData');
      
      // Use cached data if available and not forcing fresh data
      if (!forceFresh && cachedReturnedItems) {
        const parsedReturnedItems = JSON.parse(cachedReturnedItems);
        setReturnedItems(parsedReturnedItems);
        
        // Fetch fresh data in background
        fetchFreshReturnedInventoryInBackground();
        setLoading(false);
        return;
      }
      
      // If no valid cache or force fresh, fetch new data
      setLoading(true);
      await fetchFreshReturnedInventory();
    } catch (err) {
      // Try to use cached data as fallback if API fails
      const cachedReturnedItems = localStorage.getItem('returnedInventoryData');
      
      if (cachedReturnedItems) {
        const parsedReturnedItems = JSON.parse(cachedReturnedItems);
        setReturnedItems(parsedReturnedItems);
        console.log("Using cached returned inventory data after fetch error");
      } else {
        setError('Error loading returned inventory. Please try again.');
        console.error('Error fetching returned inventory:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch fresh data in background
const fetchFreshReturnedInventoryInBackground = async () => {
  try {
    await fetchFreshReturnedInventory(true);
  } catch (err) {
    console.error('Error fetching returned inventory in background:', err);
  }
};

// Function to fetch fresh data directly from API
const fetchFreshReturnedInventory = async (isBackground = false) => {
  if (!isBackground) {
    setLoading(true);
    setError(null);
  }
  
  try {
    const response = await fetch(SummaryApi.getReturnedInventory.url, {
      method: SummaryApi.getReturnedInventory.method,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      setReturnedItems(data.data);
      
      // Cache the returned inventory data
      localStorage.setItem('returnedInventoryData', JSON.stringify(data.data));
      
      // Update last refresh time for UI
      setLastRefreshTime(new Date().getTime());
    } else {
      if (!isBackground) {
        setError(data.message || 'Failed to load returned inventory');
      }
    }
  } catch (err) {
    if (!isBackground) {
      setError('Error loading returned inventory. Please try again.');
      console.error('Error fetching returned inventory:', err);
    }
    throw err;
  } finally {
    if (!isBackground) {
      setLoading(false);
    }
  }
};

  // Format date
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

  // Toggle row expansion
  const toggleRowExpansion = (id) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  // Open confirm modal
  const handleOpenConfirmModal = (returnItem) => {
    setSelectedReturn(returnItem);
    setConfirmModalOpen(true);
  };

  // Handle successful confirmation
  const handleReturnConfirmed = () => {
    // Refresh the data
    fetchReturnedInventory();
    showNotification('success', 'Inventory return confirmed successfully');
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Pending Returned Inventory</h2>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="text-center py-4">
          <p>Loading returned inventory...</p>
        </div>
      ) : returnedItems.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Technician</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {returnedItems.map((returnItem, index) => (
                <React.Fragment key={returnItem.id}>
                  <tr 
                    className={`hover:bg-gray-50 cursor-pointer ${
                      expandedRowId === returnItem.id ? 'bg-gray-50' : ''
                    }`}
                    onClick={() => toggleRowExpansion(returnItem.id)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium">
                          {index + 1}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <FiUser className="mr-2 text-gray-500" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {returnItem.technician.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {returnItem.technician.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <FiClock className="mr-2 text-gray-500" />
                        <div className="text-sm text-gray-900">
                          {formatDate(returnItem.returnedAt)}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <FiPackage className="mr-2 text-gray-500" />
                        <div className="text-sm text-gray-900">
                          {returnItem.itemCount} items ({returnItem.totalQuantity} units)
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <div className="inline-flex">
                        {expandedRowId === returnItem.id ? (
                          <FiChevronUp className="text-gray-500" />
                        ) : (
                          <FiChevronDown className="text-gray-500" />
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded details row */}
                  {expandedRowId === returnItem.id && (
                    <tr>
                      <td colSpan="5" className="px-4 py-3 bg-gray-50 border-b">
                        <div className="p-3">
                          <h3 className="font-medium text-gray-900 mb-2">
                            Returned Items
                          </h3>
                          
                          {/* Items table */}
                          <div className="overflow-x-auto bg-white border rounded-lg mb-4">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial No.</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {returnItem.items.map((item) => (
                                  <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {item.name}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        item.type === 'serialized-product' 
                                          ? 'bg-blue-100 text-blue-800' 
                                          : 'bg-green-100 text-green-800'
                                      }`}>
                                        {item.type === 'serialized-product' ? 'Serialized' : 'Generic'}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-center text-sm text-gray-500">
                                      {item.quantity} {item.unit || 'units'}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                      {item.serialNumber ? (
                                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                                          {item.serialNumber}
                                        </span>
                                      ) : (
                                        '-'
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          {/* Confirm button */}
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenConfirmModal(returnItem);
                              }}
                              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none"
                            >
                              Confirm Return
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
        <div className="text-center py-8">
          <p className="text-gray-500">No pending returned inventory items</p>
        </div>
      )}
      
      {/* Confirm Return Modal */}
      {selectedReturn && (
        <ConfirmReturnModal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          returnData={selectedReturn}
          onConfirmed={handleReturnConfirmed}
        />
      )}
    </div>
  );
};

export default ReturnedInventoryTable;