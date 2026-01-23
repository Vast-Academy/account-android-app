import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiSearch } from 'react-icons/fi';

const InventoryDetailsModal = ({ isOpen, onClose, inventory, selectedItem }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const modalRef = useRef(null);
  
  // Set up a scrollable container to ensure visibility of all content
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.scrollTop = 0;
    }
  }, [isOpen, selectedItem]);
  
  if (!isOpen) return null;
  
  // Filter inventory based on search and active tab
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.itemName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = 
      activeTab === 'all' || 
      (activeTab === 'serialized' && item.type === 'serialized-product') ||
      (activeTab === 'generic' && item.type === 'generic-product');
    
    return matchesSearch && matchesTab;
  });
  
  // If a specific item is selected, show only that one
  const displayItems = selectedItem ? 
    inventory.filter(item => item.id === selectedItem.id || item._id === selectedItem._id) : 
    filteredInventory;
  
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-start z-50 p-2 overflow-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden my-4">
        <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">
            {selectedItem ? selectedItem.itemName : 'My Inventory'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <FiX size={20} />
          </button>
        </div>
        
        {!selectedItem && (
          <div className="sticky top-16 z-10 bg-white p-4 border-b">
            <div className="relative">
              <input
                type="text"
                placeholder="Search items..."
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
            
            <div className="flex mt-4 space-x-2">
              <button 
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-md ${
                  activeTab === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                All
              </button>
              <button 
                onClick={() => setActiveTab('serialized')}
                className={`px-3 py-1 rounded-md ${
                  activeTab === 'serialized' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                Serialized
              </button>
              <button 
                onClick={() => setActiveTab('generic')}
                className={`px-3 py-1 rounded-md ${
                  activeTab === 'generic' ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
              >
                Generic
              </button>
            </div>
          </div>
        )}
        
        <div
          ref={modalRef}
          className="overflow-y-auto pb-4"
          style={{ maxHeight: 'calc(90vh - 170px)' }}
        >
          {/* First, filter the displayItems */}
          {(() => {
            const filteredDisplayItems = displayItems.filter(item => {
              if (item.type === 'serialized-product') {
                // Only show serialized items that have at least one active serial number
                return item.serializedItems && item.serializedItems.some(serialItem => serialItem.status === 'active');
              } else {
                // Only show generic items with quantity > 0
                return item.genericQuantity > 0;
              }
            });
            
            return filteredDisplayItems.length > 0 ? (
              filteredDisplayItems.map((item) => {
                // Ensure we have a valid, unique key for each item
                const itemKey = item._id || item.id || item.itemId || `item-${item.itemName}-${Math.random().toString(36).substring(2, 9)}`;
                
                return (
                  <div key={itemKey} className="p-4 border-b">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-medium">{item.itemName}</h3>
                        <p className="text-sm text-gray-500 capitalize">
                          {item.type.replace('-product', '')}
                        </p>
                      </div>
                    </div>
                    
                    {/* Show different details based on item type */}
                    {item.type === 'serialized-product' && item.serializedItems ? (
                      <div>
                        <p className="font-medium mb-2">
                          {/* Only count active serial items */}
                          {item.serializedItems.filter(serialItem => serialItem.status === 'active').length} {item.unit || 'Piece'}
                        </p>
                        {item.serializedItems.filter(serialItem => serialItem.status === 'active').length > 0 && (
                          <div className="mt-3 pt-3">
                            <p className="text-sm font-medium text-gray-700 mb-2">Serial Numbers:</p>
                            <div className="space-y-2">
                              {item.serializedItems
                                .filter(serialItem => serialItem.status === 'active')
                                .map((serialItem, index) => (
                                  <div 
                                    key={`${itemKey}-${serialItem.serialNumber || index}`} 
                                    className="text-sm bg-gray-50 p-2 rounded"
                                  >
                                    <p>{serialItem.serialNumber}</p>
                                    <p className="text-xs text-gray-500">
                                      Assigned: {serialItem.assignedAt ? new Date(serialItem.assignedAt).toLocaleDateString() : 'N/A'}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium">
                          {item.genericQuantity} {item.unit || 'Piece'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Last updated: {item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-500">No items found</p>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default InventoryDetailsModal;