// components/technician/TechnicianInventoryModal.jsx
import React, { useState, useEffect } from 'react';
import { FiArrowRight, FiX, FiPackage } from 'react-icons/fi';
import SummaryApi from '../../common';

const TechnicianInventoryModal = ({ isOpen, onClose, technician }) => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('current'); // Default to current
  
  // Reference to the most recent timestamp for each serial number or item
  const [latestTransfers, setLatestTransfers] = useState({});

  // Fetch technician's inventory transfers
  useEffect(() => {
    if (isOpen && technician) {
      fetchTechnicianInventoryHistory();
    }
  }, [isOpen, technician]);

  const fetchTechnicianInventoryHistory = async () => {
    try {
      setLoading(true);
      
      // Call backend API for technician's inventory
      const response = await fetch(`${SummaryApi.getTechnicianInventoryHistory.url}/${technician._id}`, {
        method: SummaryApi.getTechnicianInventoryHistory.method,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTransfers(data.data);
        
        // Calculate latest transfers for each item/serial
        calculateLatestTransfers(data.data);
      } else {
        setError(data.message || 'Failed to load inventory history');
      }
    } catch (err) {
      setError('Error loading inventory history. Please try again.');
      console.error('Error fetching inventory history:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Calculate the latest transfer for each item/serial number
  const calculateLatestTransfers = (transferData) => {
    const latest = {};
    const technicianFullName = `${technician.firstName} ${technician.lastName}`;
    
    // Sort transfers by timestamp (newest first)
    const sortedTransfers = [...transferData].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    // Create a serialNumber tracking object to know the current status of each serial number
    const serialNumberStatus = {};
    
    // First pass: process all transfers in chronological order (oldest to newest)
    // This helps us build a complete picture of where each item is now
    [...sortedTransfers].reverse().forEach(transfer => {
      // For serialized items, track the current location of each serial number
      if (transfer.type === 'serialized-product' && transfer.serialNumber) {
        const serialKey = `${transfer.itemId}-${transfer.serialNumber}`;
        
        // If item is transferred TO this technician, it's with them
        if (transfer.to === technicianFullName) {
          serialNumberStatus[serialKey] = 'with-technician';
        }
        // If item is transferred FROM this technician to anywhere else, it's not with them
        else if (transfer.from === technicianFullName) {
          serialNumberStatus[serialKey] = 'not-with-technician';
        }
      }
      
      // Also track generic items by maintaining running quantities
      if (transfer.type === 'generic-product') {
        const genericKey = `generic-${transfer.itemId}`;
        
        if (!serialNumberStatus[genericKey]) {
          serialNumberStatus[genericKey] = { quantity: 0 };
        }
        
        // If item is transferred TO this technician, add to quantity
        if (transfer.to === technicianFullName) {
          serialNumberStatus[genericKey].quantity += transfer.quantity;
        }
        // If item is transferred FROM this technician, subtract from quantity
        else if (transfer.from === technicianFullName) {
          serialNumberStatus[genericKey].quantity -= transfer.quantity;
        }
      }
    });
    
    // Second pass: process each transfer to build the latest transfers map
    // but only include items that are actually with the technician according to our tracking
    sortedTransfers.forEach(transfer => {
      const itemId = transfer.itemId;
      
      // For serialized products
      if (transfer.type === 'serialized-product' && transfer.serialNumber) {
        const serialKey = `${itemId}-${transfer.serialNumber}`;
        const key = serialKey; // For latest transfers map
        
        // Only process if:
        // 1. We haven't seen this item yet in our latest map
        // 2. Our tracking shows this serial number is currently with the technician
        if (!latest[key] && serialNumberStatus[serialKey] === 'with-technician') {
          // Check transfer direction for accurate status flags
          const isWithTechnician = transfer.to === technicianFullName && 
                                transfer.from !== technicianFullName;
                                
          const isReturnedByTechnician = transfer.from === technicianFullName && 
                                      transfer.to !== technicianFullName;
          
          // Only add if the last known state is that the item is with the technician
          if (serialNumberStatus[serialKey] === 'with-technician') {
            latest[key] = {
              transfer,
              isWithTechnician: true,  // Force this to true since we know it's with the technician
              isReturnedByTechnician: false
            };
          }
        }
      }
      // For generic products
      else if (transfer.type === 'generic-product') {
        const genericKey = `generic-${itemId}`;
        const key = itemId; // For latest transfers map
        
        // Only process if:
        // 1. We haven't seen this item yet in our latest map
        // 2. Our tracking shows there's a positive quantity of this item with the technician
        if (!latest[key] && 
            serialNumberStatus[genericKey] && 
            serialNumberStatus[genericKey].quantity > 0) {
          
          // Create a modified transfer with the actual current quantity
          const modifiedTransfer = {
            ...transfer,
            quantity: serialNumberStatus[genericKey].quantity
          };
          
          latest[key] = {
            transfer: modifiedTransfer,
            isWithTechnician: true,
            isReturnedByTechnician: false
          };
        }
      }
    });
    
    setLatestTransfers(latest);
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

  // Filter transfers based on selection
  const filteredTransfers = transfers.filter(transfer => {
    if (filterType === 'current') return true;
    if (filterType === 'assigned') return transfer.to === `${technician.firstName} ${technician.lastName}`;
    if (filterType === 'returned') return transfer.from === `${technician.firstName} ${technician.lastName}`;
    return true;
  });
  
  // Calculate current inventory using latest transfers only
  const calculateCurrentStock = () => {
    const stock = [];
    const itemMap = {}; // To group serial numbers by item
    
    // Process latest transfers
    Object.values(latestTransfers).forEach(({ transfer, isWithTechnician, isReturnedByTechnician }) => {
      // Only include items that are currently with the technician (latest action was assignment TO technician)
      // AND not returned/sold by technician
      if (isWithTechnician && !isReturnedByTechnician) {
        if (transfer.type === 'serialized-product' && transfer.serialNumber) {
          // For serialized products, group by item ID
          const itemId = transfer.itemId;
          
          if (!itemMap[itemId]) {
            itemMap[itemId] = {
              id: itemId,
              name: transfer.itemName,
              type: transfer.type,
              serialNumbers: [],
              quantity: 0
            };
          }
          
          // Add this serial number to the item
          itemMap[itemId].serialNumbers.push(transfer.serialNumber);
          itemMap[itemId].quantity++;
        } else if (transfer.type === 'generic-product') {
          // For generic products, check if we have a entry already
          const existingItemIndex = stock.findIndex(item => 
            item.id === transfer.itemId && item.type === 'generic-product'
          );
          
          if (existingItemIndex >= 0) {
            // Update existing item quantity
            stock[existingItemIndex].quantity += transfer.quantity;
          } else {
            // Add as new item
            stock.push({
              id: transfer.itemId,
              name: transfer.itemName,
              type: transfer.type,
              quantity: transfer.quantity,
              serialNumbers: []
            });
          }
        }
      }
    });
    
    // Add grouped serialized items to stock
    Object.values(itemMap).forEach(item => {
      stock.push(item);
    });
    
    return stock;
  };
  
  // Get current stock
  const currentStock = calculateCurrentStock();
  
  // Get total units from current stock
  const getTotalUnits = () => {
    return currentStock.reduce((sum, item) => sum + item.quantity, 0);
  };

  // Don't render anything if the modal is not open
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Modal backdrop */}
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>
      
      {/* Modal content */}
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden">
          {/* Modal header */}
          <div className="flex justify-between items-center border-b px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900">
              {technician ? `${technician.firstName} ${technician.lastName}'s Inventory History` : 'Inventory History'}
            </h3>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-500"
              onClick={onClose}
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Buttons at top */}
          <div className="border-b">
            <div className="flex px-6 py-2">
              <button 
                onClick={() => setFilterType('current')}
                className={`px-4 py-2 rounded-full text-sm font-medium mr-2 ${
                  filterType === 'current' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Current Stock
              </button>
              <button 
                onClick={() => setFilterType('assigned')}
                className={`px-4 py-2 rounded-full text-sm font-medium mr-2 ${
                  filterType === 'assigned' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Assigned
              </button>
              <button 
                onClick={() => setFilterType('returned')}
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  filterType === 'returned' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Returned
              </button>
            </div>
          </div>

          {/* Modal body */}
          <div className="p-6">
            {/* Current Stock Content - Only show when filter is current */}
            {filterType === 'current' && (
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 rounded-xl shadow-md text-white mb-6">
                <div className="flex items-center mb-3">
                  <div className="w-12 h-12 bg-purple-700 rounded-full flex items-center justify-center shadow-lg mr-3">
                    <FiPackage size={24} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{technician.firstName}'s Current Inventory</p>
                    <p className="text-sm text-purple-100">Items currently held by technician</p>
                  </div>
                </div>
                
                <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                  <div className="grid grid-cols-2 gap-3 text-center mb-3">
                    <div className="bg-purple-700/40 p-3 rounded-lg">
                      <p className="text-2xl font-bold">
                        {currentStock.length}
                      </p>
                      <p className="text-xs text-purple-200">Item Types</p>
                    </div>
                    <div className="bg-purple-700/40 p-3 rounded-lg">
                      <p className="text-2xl font-bold">
                        {getTotalUnits()}
                      </p>
                      <p className="text-xs text-purple-200">Total Units</p>
                    </div>
                  </div>
                  
                  {/* Current Stock Items */}
                  {currentStock.length > 0 ? (
                    <div className="mt-2">
                      <p className="text-sm mb-2 font-medium">Current Items:</p>
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {currentStock.map((item, index) => (
                          <div key={index} className="flex justify-between items-center bg-purple-700/30 p-2 rounded-md">
                            <div className="flex flex-col">
                              <div className="text-sm truncate max-w-[70%] font-medium">{item.name}</div>
                              {item.type === 'serialized-product' && item.serialNumbers && item.serialNumbers.length > 0 && (
                                <div className="text-xs text-purple-200">
                                  S/N: {item.serialNumbers[0]}{item.serialNumbers.length > 1 ? ` +${item.serialNumbers.length - 1} more` : ''}
                                </div>
                              )}
                            </div>
                            <div className="px-2 py-1 bg-purple-800/50 rounded-md text-xs">
                              {item.quantity} pcs
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-purple-100">No items currently held by technician</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md">
                {error}
              </div>
            )}
            
            {/* Show transaction table for assigned/returned filters */}
            {(filterType === 'assigned' || filterType === 'returned') && (
              loading ? (
                <div className="text-center py-4">
                  <p>Loading inventory history...</p>
                </div>
              ) : filteredTransfers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Transfer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">By</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredTransfers.map((transfer, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {formatDate(transfer.timestamp)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium">{transfer.itemName}</div>
                            <div className="text-xs text-gray-500">ID: {transfer.itemId}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                            <div className="flex items-center justify-center">
                              <span>{transfer.from}</span>
                              <FiArrowRight className="mx-2 text-blue-500" />
                              <span>{transfer.to}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm">
                              {transfer.quantity} {transfer.unit}
                              {transfer.type === 'serialized-product' && transfer.serialNumber && (
                                <div className="text-xs text-gray-500">
                                  S/N: {transfer.serialNumber}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {transfer.transferredBy}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No {filterType} records found</p>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicianInventoryModal;