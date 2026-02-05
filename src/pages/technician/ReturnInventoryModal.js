import React, { useState, useEffect } from 'react';
import { 
  X, 
  Package, 
  ChevronDown,
  AlertCircle,
  Check
} from 'lucide-react';
import SummaryApi from '../../common';

const ReturnInventoryModal = ({ isOpen, onClose, onInventoryReturned, darkMode = false }) => {
  const [inventory, setInventory] = useState([]);
  const [filteredInventory, setFilteredInventory] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedItems, setExpandedItems] = useState([]);
  // Add new state for confirmation modal
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Fetch technician's inventory
  useEffect(() => {
    if (isOpen) {
      fetchInventory();
    }
  }, [isOpen]);
  
  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await fetch(SummaryApi.getTechnicianInventory.url, {
        method: SummaryApi.getTechnicianInventory.method,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Filter out items with 0 quantity
        const activeInventory = data.data.filter(item => {
          if (item.type === 'serialized-product') {
            return item.serializedItems?.some(si => si.status === 'active');
          }
          return item.genericQuantity > 0;
        });

        setInventory(activeInventory);
        setFilteredInventory(activeInventory);
      } else {
        setError(data.message || 'Failed to load inventory');
      }
    } catch (err) {
      setError('Error loading inventory. Please try again.');
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Get quantity of an item
  const getItemQuantity = (item) => {
    if (item.type === 'serialized-product') {
      return item.serializedItems?.filter(si => si.status === 'active').length || 0;
    } else {
      return item.genericQuantity || 0;
    }
  };

  // Handle expanding/collapsing items
  const handleItemExpand = (itemKey) => {
    if (expandedItems.includes(itemKey)) {
      setExpandedItems(expandedItems.filter(id => id !== itemKey));
    } else {
      setExpandedItems([...expandedItems, itemKey]);
    }
  };

  // Toggle item selection for serialized items
  const toggleSerialItemSelection = (item, serialNumber) => {
    const itemKey = item._id || item.itemId || item.id;
    
    const existingIndex = selectedItems.findIndex(
      selected => selected.itemId === itemKey && selected.serialNumber === serialNumber
    );
    
    if (existingIndex >= 0) {
      // Remove if already selected
      const newSelected = [...selectedItems];
      newSelected.splice(existingIndex, 1);
      setSelectedItems(newSelected);
    } else {
      // Add to selected
      setSelectedItems([
        ...selectedItems,
        {
          itemId: itemKey,
          itemName: item.itemName, // Add item name for display in confirmation
          type: 'serialized-product',
          serialNumber
        }
      ]);
    }
  };
  
  // Handle generic item quantity change
  const handleQuantityChange = (item, value) => {
    const itemKey = item._id || item.itemId || item.id;
    const quantity = parseInt(value);
    const maxQuantity = item.genericQuantity;

    if (isNaN(quantity) || quantity < 0 || quantity > maxQuantity) {
      return;
    }
    
    const existingIndex = selectedItems.findIndex(
      selectedItem => selectedItem.itemId === itemKey && selectedItem.type === 'generic-product'
    );
    
    if (quantity > 0) {
      // Add or update item
      if (existingIndex >= 0) {
        const newSelected = [...selectedItems];
        newSelected[existingIndex].quantity = quantity;
        setSelectedItems(newSelected);
      } else {
        setSelectedItems([
          ...selectedItems,
          {
            itemId: itemKey,
            itemName: item.itemName, // Add item name for display in confirmation
            type: 'generic-product',
            quantity
          }
        ]);
      }
    } else {
      // Remove item if quantity is 0
      if (existingIndex >= 0) {
        const newSelected = [...selectedItems];
        newSelected.splice(existingIndex, 1);
        setSelectedItems(newSelected);
      }
    }
  };
  
  // Check if a serial item is selected
  const isSerialItemSelected = (itemId, serialNumber) => {
    return selectedItems.some(
      item => item.itemId === itemId && item.serialNumber === serialNumber
    );
  };
  
  // Get selected quantity for generic item
  const getSelectedQuantity = (itemId) => {
    const item = selectedItems.find(
      item => item.itemId === itemId && item.type === 'generic-product'
    );
    return item ? item.quantity : 0;
  };
  
  // Show confirmation dialog before returning items
  const showReturnConfirmation = () => {
    if (selectedItems.length === 0) {
      setError('No items selected for return');
      return;
    }
    
    setShowConfirmation(true);
  };
  
  // Get total number of items being returned
  const getTotalItemsCount = () => {
    return selectedItems.reduce((total, item) => {
      if (item.type === 'serialized-product') {
        return total + 1; // Each serialized item counts as 1
      } else {
        return total + item.quantity; // Add quantity for generic items
      }
    }, 0);
  };
  
  // Submit selected items to return
  const handleReturnItems = async () => {
    try {
      setLoading(true);
      setShowConfirmation(false); // Hide confirmation
      
      // Process each item separately
      for (const item of selectedItems) {
        console.log("Sending return request:", item);
        const response = await fetch(SummaryApi.returnInventoryToManager.url, {
          method: SummaryApi.returnInventoryToManager.method,
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify(item)
        });
        
        const data = await response.json();
        
        if (!data.success) {
          setError(data.message || 'Failed to return some items');
          // Continue with other items
        }
      }
      
      // Refresh inventory after return
      await fetchInventory();
      
      // Notify parent component
      if (onInventoryReturned) {
        onInventoryReturned();
      }
      
      // Reset selections
      setSelectedItems([]);
      
      // Close modal
      onClose();
    } catch (err) {
      setError('Server error. Please try again.');
      console.error('Error returning inventory:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Cancel the confirmation
  const cancelConfirmation = () => {
    setShowConfirmation(false);
  };
  
  // Find item details by ID
  const getItemNameById = (itemId) => {
    const item = inventory.find(i => (i.id === itemId || i.itemId === itemId || i._id === itemId));
    return item ? item.itemName : 'Unknown Item';
  };
  
  if (!isOpen) return null;
  
  return (
    <div className={`fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4`}>
      <div className={`w-full max-w-md ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'} rounded-2xl shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className={`p-4 ${darkMode ? 'border-b border-gray-700' : 'border-b border-gray-200'} flex justify-between items-center`}>
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-full ${darkMode ? 'bg-teal-600' : 'bg-teal-500'} flex items-center justify-center`}>
              <Package size={20} className="text-white" />
            </div>
            <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Return Inventory</h2>
          </div>
          <button 
            onClick={onClose}
            className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
          >
            <X size={20} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`m-4 p-3 ${darkMode ? 'bg-red-900/30 text-red-300' : 'bg-red-50 text-red-600'} rounded-md`}>
            {error}
          </div>
        )}

        {/* Inventory List */}
        <div 
          className="overflow-y-auto" 
          style={{ maxHeight: 'calc(90vh - 190px)' }}
        >
          {loading ? (
            <div className="p-4 text-center">
              <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Loading inventory...</p>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No inventory items to return.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredInventory.map((item, index) => {
                // Make sure we have a solid ID for the item
                const itemKey = item._id || item.itemId || item.id;
                const itemCount = getItemQuantity(item);
                const isExpanded = expandedItems.includes(itemKey);
                
                return (
                  <div key={itemKey}>
                    <div 
                      className={`p-4 flex items-center justify-between ${darkMode ? 'hover:bg-gray-700/50' : 'hover:bg-gray-100/50'} cursor-pointer transition-colors`}
                    >
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full ${darkMode ? 'bg-teal-600' : 'bg-teal-500'} flex items-center justify-center mr-3 text-white font-bold`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{item.itemName}</p>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} capitalize`}>
                            {item.type.replace('-product', '')}
                          </p>
                        </div>
                      </div>
                      
                      {item.type === 'serialized-product' ? (
                        <div 
                          className="cursor-pointer"
                          onClick={() => handleItemExpand(itemKey)}
                        >
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            viewBox="0 0 24 24" 
                            width="18" 
                            height="18" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            className={`transition-transform duration-200 ${isExpanded ? 'transform rotate-180' : ''} ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                          >
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                      ) : (
                        <div className="flex items-center">
                        <button 
                          onClick={() => handleQuantityChange(item, Math.max(0, getSelectedQuantity(itemKey) - 1))}
                          className={`w-8 h-8 flex items-center justify-center rounded-l-md ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'}`}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={item.genericQuantity}
                          value={getSelectedQuantity(itemKey)}
                          readOnly
                          className={`w-16 text-center py-1 appearance-none 
                            ${darkMode ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-100 text-gray-800'}
                            [&::-webkit-inner-spin-button]:appearance-none 
                            [&::-webkit-outer-spin-button]:appearance-none`}
                        />
                        <button 
                          onClick={() => handleQuantityChange(item, Math.min(item.genericQuantity, getSelectedQuantity(itemKey) + 1))}
                          className={`w-8 h-8 flex items-center justify-center rounded-r-md ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-800'}`}
                        >
                          +
                        </button>
                      </div>
                      )}
                    </div>
                    
                    {/* Expanded view for serialized items */}
                    {item.type === 'serialized-product' && isExpanded && (
                      <div className={`px-4 pb-4 ${darkMode ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
                        <div className="ml-11 border-l-2 border-teal-500 pl-4 space-y-2">
                          {item.serializedItems
                            .filter(s => s.status === 'active')
                            .map((serialItem) => (
                              <div 
                                key={serialItem.serialNumber}
                                className={`flex items-center p-2 rounded cursor-pointer ${
                                  isSerialItemSelected(itemKey, serialItem.serialNumber) 
                                    ? `${darkMode ? 'bg-teal-600/40' : 'bg-teal-100'} ${darkMode ? 'border-teal-500' : 'border-teal-500'}` 
                                    : `${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} border`
                                }`}
                                onClick={() => toggleSerialItemSelection(item, serialItem.serialNumber)}
                              >
                                <input 
                                  type="checkbox"
                                  className={`mr-2 ${darkMode ? 'text-teal-500' : ''}`}
                                  checked={isSerialItemSelected(itemKey, serialItem.serialNumber)}
                                  onChange={() => {}} // React requires onChange with checked
                                />
                                <span className={darkMode ? 'text-gray-200' : 'text-gray-800'}>{serialItem.serialNumber}</span>
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`sticky bottom-0 p-4 ${darkMode ? 'border-t border-gray-700 bg-gray-800' : 'border-t border-gray-200 bg-white'} flex justify-between space-x-3`}>
          <button 
            onClick={onClose}
            className={`px-4 py-2 rounded-lg flex-1 ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
          >
            Cancel
          </button>
          <button 
            onClick={showReturnConfirmation} // Changed to show confirmation first
            disabled={selectedItems.length === 0 || loading}
            className={`px-4 py-2 rounded-lg flex-1 flex items-center justify-center ${
              selectedItems.length === 0 || loading 
                ? `${darkMode ? 'bg-teal-800 text-gray-500' : 'bg-teal-200 text-gray-400'} cursor-not-allowed`
                : `${darkMode ? 'bg-teal-600 hover:bg-teal-700' : 'bg-teal-500 hover:bg-teal-600'} text-white`
            }`}
          >
            {loading ? 'Processing...' : 'Return Selected'}
          </button>
        </div>
        
        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">
            <div className={`w-full max-w-md ${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl overflow-hidden`}>
              <div className={`p-4 ${darkMode ? 'border-b border-gray-700' : 'border-b'} flex items-center`}>
                <div className={`w-10 h-10 flex items-center justify-center rounded-full ${darkMode ? 'bg-amber-600/20' : 'bg-amber-100'} mr-3`}>
                  <AlertCircle size={24} className="text-amber-600" />
                </div>
                <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  Confirm Return
                </h3>
              </div>
              
              <div className="p-4">
                <p className={`mb-4 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Are you sure you want to return {getTotalItemsCount()} item{getTotalItemsCount() !== 1 ? 's' : ''}? 
                  Please confirm once:
                </p>
                
                <div className={`mb-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-50'} p-3 rounded-md max-h-48 overflow-y-auto`}>
                  {/* List all items being returned */}
                  <ul className="space-y-2">
                    {selectedItems.map((item, index) => (
                      <li key={index} className={`flex justify-between items-center ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        <span className="font-medium">
                          {item.itemName || getItemNameById(item.itemId)}
                        </span>
                        {item.type === 'serialized-product' ? (
                          <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            S/N: {item.serialNumber}
                          </span>
                        ) : (
                          <span className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {item.quantity} {item.quantity > 1 ? 'pcs' : 'pc'}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={cancelConfirmation}
                    className={`flex-1 py-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                  >
                    No, Cancel
                  </button>
                  <button
                    onClick={handleReturnItems}
                    className={`flex-1 py-2 rounded-lg ${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white flex items-center justify-center`}
                  >
                    <Check size={18} className="mr-2" /> Yes, Return Items
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReturnInventoryModal;