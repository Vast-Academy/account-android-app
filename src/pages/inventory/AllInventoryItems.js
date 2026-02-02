import React, { useState, useEffect, useRef } from 'react';
import { FiTrash, FiPlus, FiSearch } from 'react-icons/fi';
import SummaryApi from '../../common';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import Modal from '../../components/Modal';

const AllInventoryItems = ({ searchTerm = '', refreshTrigger = 0 }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const CACHE_STALENESS_TIME = 15 * 60 * 1000;
  const [lastRefreshTime, setLastRefreshTime] = useState(0);
  // const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isViewStockModalOpen, setIsViewStockModalOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
const [stockEntriesToSave, setStockEntriesToSave] = useState([]);
const [currentSavingItem, setCurrentSavingItem] = useState(null);
const [saveLoading, setSaveLoading] = useState(false);
  const [confirmData, setConfirmData] = useState({
    title: '',
    message: '',
    type: 'warning',
    confirmText: 'Confirm',
    onConfirm: () => {}
  });

  // State to track which row is expanded
  const [expandedRowId, setExpandedRowId] = useState(null);

  // Fetch all inventory items
  useEffect(() => {
    fetchAllItems();
  }, [refreshTrigger]);
  
  const fetchAllItems = async (forceFresh = false) => {
    try {
      // Check for cached data
      const cachedItems = localStorage.getItem('inventoryItems');
      
      // Use cached data if available and not forcing fresh data
      if (cachedItems && !forceFresh) {
        setItems(JSON.parse(cachedItems));
        
        // Fetch fresh data in background
        fetchFreshItemsInBackground();
        setLoading(false);
        return;
      }
      
      // If no valid cache or force fresh, fetch new data
      setLoading(true);
      await fetchFreshItems();
    } catch (err) {
      // Try to use cached data as fallback if API fails
      const cachedItems = localStorage.getItem('inventoryItems');
      
      if (cachedItems) {
        setItems(JSON.parse(cachedItems));
        console.log("Using cached inventory items after fetch error");
      } else {
        setError('Server error. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

 // बैकग्राउंड में ताज़ा डेटा फेच करने का फंक्शन
const fetchFreshItemsInBackground = async () => {
  try {
    // तीनों प्रकार के इन्वेंटरी आइटम्स को पैरेलल में फेच करें
    const [serializedResponse, genericResponse, servicesResponse] = await Promise.all([
      fetch(`${SummaryApi.getInventoryByType.url}/serialized-product`, {
        method: SummaryApi.getInventoryByType.method,
        credentials: 'include'
      }),
      fetch(`${SummaryApi.getInventoryByType.url}/generic-product`, {
        method: SummaryApi.getInventoryByType.method,
        credentials: 'include'
      }),
      fetch(`${SummaryApi.getInventoryByType.url}/service`, {
        method: SummaryApi.getInventoryByType.method,
        credentials: 'include'
      })
    ]);
    
    // सभी रिस्पांस को पार्स करें
    const [serializedData, genericData, servicesData] = await Promise.all([
      serializedResponse.json(),
      genericResponse.json(),
      servicesResponse.json()
    ]);
    
    // सभी आइटम्स को कम्बाइन करें और टाइप प्रॉपर्टी जोड़ें
    const combinedItems = [
      ...(serializedData.success ? serializedData.items.map(item => ({ ...item, itemType: 'serialized' })) : []),
      ...(genericData.success ? genericData.items.map(item => ({ ...item, itemType: 'generic' })) : []),
      ...(servicesData.success ? servicesData.items.map(item => ({ ...item, itemType: 'service' })) : [])
    ];
    
    // नया टाइमस्टैम्प सेट करें
    const newTimestamp = new Date().getTime();
    
    // डेटा को localStorage में सेव करें
    localStorage.setItem('inventoryItems', JSON.stringify(combinedItems));
    
    // अगर नया डेटा पुराने से अलग है, तो UI अपडेट करें
    if (JSON.stringify(combinedItems) !== JSON.stringify(items)) {
      setItems(combinedItems);
      setLastRefreshTime(newTimestamp);
    }
  } catch (err) {
    console.error('Error fetching inventory items in background:', err);
  }
};

// ताज़ा डेटा फेच करने का मुख्य फंक्शन
const fetchFreshItems = async () => {
  try {
    // तीनों प्रकार के इन्वेंटरी आइटम्स को पैरेलल में फेच करें
    const [serializedResponse, genericResponse, servicesResponse] = await Promise.all([
      fetch(`${SummaryApi.getInventoryByType.url}/serialized-product`, {
        method: SummaryApi.getInventoryByType.method,
        credentials: 'include'
      }),
      fetch(`${SummaryApi.getInventoryByType.url}/generic-product`, {
        method: SummaryApi.getInventoryByType.method,
        credentials: 'include'
      }),
      fetch(`${SummaryApi.getInventoryByType.url}/service`, {
        method: SummaryApi.getInventoryByType.method,
        credentials: 'include'
      })
    ]);
    
    // सभी रिस्पांस को पार्स करें
    const [serializedData, genericData, servicesData] = await Promise.all([
      serializedResponse.json(),
      genericResponse.json(),
      servicesResponse.json()
    ]);
    
    // सभी आइटम्स को कम्बाइन करें और टाइप प्रॉपर्टी जोड़ें
    const combinedItems = [
      ...(serializedData.success ? serializedData.items.map(item => ({ ...item, itemType: 'serialized' })) : []),
      ...(genericData.success ? genericData.items.map(item => ({ ...item, itemType: 'generic' })) : []),
      ...(servicesData.success ? servicesData.items.map(item => ({ ...item, itemType: 'service' })) : [])
    ];
    
    // नया टाइमस्टैम्प सेट करें
    const newTimestamp = new Date().getTime();
    
    // डेटा को स्टेट और localStorage में सेव करें
    setItems(combinedItems);
    setLastRefreshTime(newTimestamp);
    localStorage.setItem('inventoryItems', JSON.stringify(combinedItems));
  } catch (err) {
    throw err; // पेरेंट try-catch ब्लॉक में एरर को हैंडल करने दें
  }
};

// रिफ्रेश बटन हैंडलर
const handleRefresh = () => {
  fetchAllItems(true); // फोर्स फ्रेश डेटा फेच
};

  const handlePrepareForSaving = (entries, item) => {
    setStockEntriesToSave(entries);
    setCurrentSavingItem(item);
    setShowSaveConfirmation(true);
  };
  
  const handleSaveStock = async () => {
    try {
      setSaveLoading(true);
      
      // Submit each stock entry
      for (const entry of stockEntriesToSave) {
        const response = await fetch(SummaryApi.addInventoryStock.url, {
          method: SummaryApi.addInventoryStock.method,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            itemId: currentSavingItem.id,
            ...entry
          })
        });
        
        const data = await response.json();
        
        if (!data.success) {
          showNotification('error', data.message || 'Failed to add stock');
          setSaveLoading(false);
          return;
        }
      }
      
      showNotification('success', 'Stock added successfully');
      setShowSaveConfirmation(false);

      // localStorage से कैश को हटा दें
      localStorage.removeItem('inventoryItems');
      fetchAllItems(); // Refresh the data
      setIsAddStockModalOpen(false);
    } catch (err) {
      showNotification('error', 'Server error. Please try again later.');
      console.error('Error adding stock:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  // Open view stock modal
  const openViewStockModal = (item) => {
    setSelectedStockItem(item);
    setIsViewStockModalOpen(true);
  };

  // Open add stock modal
  const openAddStockModal = (item) => {
    setSelectedStockItem(item);
    setIsAddStockModalOpen(true);
  };

  // Show confirmation dialog helper function
  const showConfirmation = (title, message, type, confirmText, onConfirm) => {
    setConfirmData({
      title,
      message,
      type,
      confirmText,
      onConfirm
    });
    setConfirmDialogOpen(true);
  };

  // Delete an inventory item (admin only)
  const handleDeleteItem = async (id) => {
    showConfirmation(
      'Delete Item',
      'Are you sure you want to delete this item? This action cannot be undone.',
      'warning',
      'Delete',
      async () => {
        try {
          const response = await fetch(`${SummaryApi.deleteInventoryItem.url}/${id}`, {
            method: SummaryApi.deleteInventoryItem.method,
            credentials: 'include'
          });
          
          const data = await response.json();
          
          if (data.success) {
            const updatedItems = items.filter(item => item.id !== id);
            setItems(updatedItems);
            
            // localStorage में भी अपडेट करें
            localStorage.setItem('inventoryItems', JSON.stringify(updatedItems));
            
            showNotification('success', 'Item deleted successfully');
          } else {
            showNotification('error', data.message || 'Failed to delete item');
            setError(data.message || 'Failed to delete item');
          }
        } catch (err) {
          showNotification('error', 'Server error. Please try again later.');
          setError('Server error. Please try again later.');
          console.error('Error deleting item:', err);
        }
      }
    );
  };
  
  // Filter items based on search term
  const filteredItems = items.filter(
    item => item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stock display for different item types
  const getStockDisplay = (item) => {
    if (item.itemType === 'serialized') {
      return item.stock ? item.stock.length : 0;
    } else if (item.itemType === 'generic') {
      return item.stock ? item.stock.reduce((total, stock) => total + parseInt(stock.quantity, 10), 0) : 0;
    } else {
      return 'N/A'; // Services don't have stock
    }
  };

  // Get human-readable item type
  const getItemTypeDisplay = (type) => {
    switch (type) {
      case 'serialized':
        return 'Serialized Product';
      case 'generic':
        return 'Generic Product';
      case 'service':
        return 'Service';
      default:
        return type;
    }
  };

   // Function to toggle expanded row
   const toggleRowExpansion = (itemId) => {
    if (expandedRowId === itemId) {
      // If clicking the same row that's already expanded, collapse it
      setExpandedRowId(null);
    } else {
      // Otherwise expand the clicked row (and collapse any previously expanded row)
      setExpandedRowId(itemId);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {/* Search */}
      {/* <div className="flex justify-end mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search products..."
            className="pl-10 pr-4 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div> */}
      
      {/* Items List */}
      <div className="bg-white rounded-lg overflow-hidden">
        {/* <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-700">All Inventory Items</h2>
        </div> */}
        
        {loading ? (
          <div className="p-6 text-center text-gray-500">
            Loading inventory items...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {items.length === 0 ? 'No inventory items found.' : 'No items match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.NO</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NAME</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TYPE</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BRANCH</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UNIT</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PRICE</th>
                  {user.role === 'admin' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PURCHASE PRICE</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STOCK</th>
                  {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ACTIONS</th> */}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item, index) => (
                  <ClickableTableRow
                    key={item.id}
                    item={item}
                    index={index}
                    user={user}
                    handleDeleteItem={handleDeleteItem}
                    getItemTypeDisplay={getItemTypeDisplay}
                    getStockDisplay={getStockDisplay}
                    openViewStockModal={() => openViewStockModal(item)}
                    openAddStockModal={() => openAddStockModal(item)}
                    isExpanded={expandedRowId === item.id}
                    toggleExpanded={() => toggleRowExpansion(item.id)}
                  />
                ))}
              </tbody>
            </table>

            
          </div>
        )}
      </div>
      
      {/* View Stock Modal */}
      <Modal
        isOpen={isViewStockModalOpen}
        onClose={() => setIsViewStockModalOpen(false)}
        title={`Stock Details - ${selectedStockItem?.name || ''}`}
        size="lg"
      >
        {selectedStockItem && (
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedStockItem.itemType === 'serialized' ? 'Serial Numbers' : 'Stock Entries'}
              </h3>
              <p className="text-sm text-gray-500">
                Total Stock: {
                  selectedStockItem.itemType === 'serialized' 
                    ? (selectedStockItem.stock ? selectedStockItem.stock.length : 0)
                    : (selectedStockItem.stock ? selectedStockItem.stock.reduce((total, stock) => total + parseInt(stock.quantity, 10), 0) : 0)
                } {selectedStockItem.unit}
              </p>
            </div>
            
            {selectedStockItem.stock && selectedStockItem.stock.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sr No.</th>
                      {selectedStockItem.itemType === 'serialized' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial Number</th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Added</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedStockItem.stock.map((stockItem, index) => (
                      <tr key={selectedStockItem.itemType === 'serialized' ? stockItem.serialNumber : index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                        {selectedStockItem.itemType === 'serialized' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stockItem.serialNumber}</td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stockItem.quantity}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(stockItem.date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No stock entries found for this product in your branch.
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsViewStockModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Stock Modal */}
      <Modal
  isOpen={isAddStockModalOpen}
  onClose={() => setIsAddStockModalOpen(false)}
  title={`Add Stock for ${selectedStockItem?.name || ''}`}
  size="lg"
>
  {selectedStockItem && (
    <div>
      {/* Use different forms based on item type */}
      {selectedStockItem.itemType === 'serialized' ? (
        <SerializedStockForm 
          item={selectedStockItem} 
          onClose={() => setIsAddStockModalOpen(false)} 
          showNotification={showNotification}
          onSuccess={() => {
            setIsAddStockModalOpen(false);
            fetchAllItems(); // Refresh the data
          }}
          onPrepareForSaving={handlePrepareForSaving}
        />
      ) : selectedStockItem.itemType === 'generic' ? (
        <GenericStockForm 
          item={selectedStockItem} 
          onClose={() => setIsAddStockModalOpen(false)} 
          showNotification={showNotification}
          onSuccess={() => {
            setIsAddStockModalOpen(false);
            fetchAllItems(); // Refresh the data
          }}
          onPrepareForSaving={handlePrepareForSaving}
        />
      ) : (
        <div className="p-6 text-center text-gray-500">
          Stock cannot be added to service items.
        </div>
      )}
    </div>
  )}
</Modal>
      
      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        title={confirmData.title}
        message={confirmData.message}
        confirmText={confirmData.confirmText}
        type={confirmData.type}
        onConfirm={confirmData.onConfirm}
      />

      {/* Confirm Save Modal */}
<Modal
  isOpen={showSaveConfirmation}
  onClose={() => setShowSaveConfirmation(false)}
  title="Confirm Save"
  size="md"
>
  <div className="py-4">
    <div className="mb-6 flex items-center justify-center">
      <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
    
    <h3 className="text-xl font-medium text-center mb-4">Ready to Save</h3>
    
    <p className="text-center text-gray-600 mb-6">
      {currentSavingItem?.itemType === 'serialized' ? (
        <>You are about to save <span className="font-bold">{stockEntriesToSave.length}</span> serial number{stockEntriesToSave.length !== 1 ? 's' : ''} for item <span className="font-bold">{currentSavingItem?.name}</span>.</>
      ) : (
        <>You are about to save <span className="font-bold">
          {stockEntriesToSave.reduce((sum, entry) => sum + Number(entry.quantity), 0)}
        </span> {currentSavingItem?.unit || 'items'} for item <span className="font-bold">{currentSavingItem?.name}</span>.</>
      )}
    </p>
    
    <div className="mt-8 flex justify-center space-x-4">
      <button
        type="button"
        onClick={() => setShowSaveConfirmation(false)}
        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSaveStock}
        disabled={saveLoading}
        className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 focus:outline-none disabled:opacity-50"
      >
        {saveLoading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Saving...
          </span>
        ) : (
          <span className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Save & Close
          </span>
        )}
      </button>
    </div>
  </div>
</Modal>
    </div>
  );
};

// Form for adding serialized product stock
const SerializedStockForm = ({ item, onClose, showNotification, onSuccess, onPrepareForSaving }) => {
    const [error, setError] = useState(null);
    const [stockEntries, setStockEntries] = useState([
      {
        serialNumber: '',
        quantity: 1,
        date: new Date().toISOString().split('T')[0]
      }
    ]);
    const [serialNumberStatus, setSerialNumberStatus] = useState({});
    const [stockEntriesToSave, setStockEntriesToSave] = useState([]);
    const [checkingSerial, setCheckingSerial] = useState(false);
    const [loading, setLoading] = useState(false);
    const barcodeInputRef = useRef(null);
    const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  
    useEffect(() => {
      // Focus on first input when form opens
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }, []);
  
    // Reset stock entries form
    const resetStockEntriesForm = () => {
      setStockEntries([
        {
          serialNumber: '',
          quantity: 1,
          date: new Date().toISOString().split('T')[0]
        }
      ]);
      setError(null);
      setSerialNumberStatus({});
      setStockEntriesToSave([]);
    };
  
    // Handle barcode input
    const handleBarcodeInput = (e, index) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        
        const scannedValue = e.target.value.trim();
        
        if (!scannedValue) {
          return;
        }
        
        const updatedEntries = [...stockEntries];
        updatedEntries[index].serialNumber = scannedValue;
        setStockEntries(updatedEntries);
        
        checkSerialNumber(scannedValue, index);
        
        setTimeout(() => {
          if (index === stockEntries.length - 1) {
            handleAddStockEntry();
          } else {
            const nextInput = document.getElementById(`barcode-input-${index + 1}`);
            if (nextInput) {
              nextInput.focus();
            }
          }
        }, 100);
      }
    };
    
    // Add a new stock entry
    const handleAddStockEntry = () => {
      const newEntryIndex = stockEntries.length;
      
      setStockEntries([
        ...stockEntries,
        {
          serialNumber: '',
          quantity: 1,
          date: new Date().toISOString().split('T')[0]
        }
      ]);
      
      setTimeout(() => {
        const newInput = document.getElementById(`barcode-input-${newEntryIndex}`);
        if (newInput) {
          newInput.focus();
        }
      }, 100);
    };
    
    // Remove a stock entry
    const handleRemoveStockEntry = (index) => {
      const updatedEntries = stockEntries.filter((_, i) => i !== index);
      setStockEntries(updatedEntries);
    };
    
    // Handle input change for stock entries
    const handleStockEntryChange = (index, field, value) => {
      const updatedEntries = [...stockEntries];
      updatedEntries[index][field] = value;
      setStockEntries(updatedEntries);
      
      // Check serial number if changed
      if (field === 'serialNumber' && value.trim()) {
        if (window.serialCheckTimeout) {
          clearTimeout(window.serialCheckTimeout);
        }
        
        window.serialCheckTimeout = setTimeout(() => {
          checkSerialNumber(value, index);
        }, 500);
      }
    };
  
    // Check serial number validity
    const checkSerialNumber = async (serialNumber, index) => {
      if (!serialNumber.trim()) return;
      
      // Check if this serial number already exists in current entries
      const isDuplicateInCurrentEntries = stockEntries.some(
        (entry, i) => i !== index && entry.serialNumber === serialNumber
      );
      
      if (isDuplicateInCurrentEntries) {
        setSerialNumberStatus(prev => ({
          ...prev,
          [index]: {
            valid: false,
            message: 'Duplicate serial number in current entries'
          }
        }));
        return;
      }
      
      try {
        setCheckingSerial(true);
        
        const response = await fetch(`${SummaryApi.checkSerialNumber.url}/${serialNumber}`, {
          method: SummaryApi.checkSerialNumber.method,
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.exists) {
          setSerialNumberStatus(prev => ({
            ...prev,
            [index]: {
              valid: false,
              message: `Serial number already exists for item: ${data.item.name}`
            }
          }));
        } else {
          setSerialNumberStatus(prev => ({
            ...prev,
            [index]: {
              valid: true,
              message: 'Serial number is valid'
            }
          }));
        }
      } catch (err) {
        console.error('Error checking serial number:', err);
        setSerialNumberStatus(prev => ({
          ...prev,
          [index]: {
            valid: false,
            message: 'Error checking serial number'
          }
        }));
      } finally {
        setCheckingSerial(false);
      }
    };
  
    const prepareForSaving = () => {
      // For serial products, filter valid entries with serial numbers
      const validEntries = stockEntries
        .filter(entry => 
          entry.serialNumber.trim() !== '' && 
          !stockEntries.some((e, i) => 
            e.serialNumber === entry.serialNumber && 
            stockEntries.indexOf(entry) > i
          ) &&
          serialNumberStatus[stockEntries.indexOf(entry)]?.valid === true
        )
        .map(entry => ({
          ...entry,
          quantity: 1 // Always 1 for serial products
        }));
      
      if (validEntries.length === 0) {
        setError('No valid serial numbers to save');
        showNotification('error', 'No valid serial numbers to save');
        return;
      }
      
      // Call parent component function instead of showing modal
      onPrepareForSaving(validEntries, item);
    };

  
    // Discard and close button handler
    const handleDiscardAndClose = () => {
      if (stockEntries.some(entry => entry.serialNumber.trim() !== '')) {
        // Confirm before discarding
        if (window.confirm('All unsaved changes will be lost. Are you sure you want to discard them?')) {
          resetStockEntriesForm();
          onClose();
        }
      } else {
        resetStockEntriesForm();
        onClose();
      }
    };
  
    return (
      <div>
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        <div className="mb-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Serial Number Entry</h3>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-2">Scan barcode or type manually</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Connect your barcode scanner and scan directly into the Serial Number field.
          </p>
          <p className="text-sm text-gray-600 mt-1">
            <span className="font-semibold">Pro Tip:</span> Press <kbd className="px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded">Enter</kbd> after each serial number to automatically move to the next field.
          </p>
          <p className="text-sm text-gray-600 mt-1 font-semibold">
            Note: Quantity is fixed at 1 for each serial number entry.
          </p>
        </div>
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {stockEntries.map((entry, index) => (
            <div 
              key={index} 
              className={`p-4 border rounded-md ${
                serialNumberStatus[index]?.valid === false 
                  ? 'border-red-300 bg-red-50' 
                  : serialNumberStatus[index]?.valid === true 
                    ? 'border-green-300 bg-green-50' 
                    : 'bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Item #{index + 1}</h3>
                {stockEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStockEntry(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serial Number *
                  </label>
                  <div className="relative">
                    <input
                      id={`barcode-input-${index}`}
                      type="text"
                      value={entry.serialNumber}
                      onChange={(e) => handleStockEntryChange(index, 'serialNumber', e.target.value)}
                      onKeyDown={(e) => handleBarcodeInput(e, index)}
                      className={`w-full p-2 border rounded-md ${
                        serialNumberStatus[index]?.valid === false 
                          ? 'border-red-300 bg-red-50 pr-10' 
                          : serialNumberStatus[index]?.valid === true 
                            ? 'border-green-300 bg-green-50 pr-10' 
                            : 'bg-white'
                      }`}
                      placeholder="Scan or type serial number"
                      ref={index === 0 ? barcodeInputRef : null}
                      autoFocus={index > 0 && index === stockEntries.length - 1}
                      required
                    />
                    {checkingSerial && entry.serialNumber.trim() && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                    {serialNumberStatus[index]?.valid === true && !checkingSerial && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {serialNumberStatus[index]?.valid === false && !checkingSerial && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {serialNumberStatus[index]?.message && (
                    <p className={`mt-1 text-xs ${
                      serialNumberStatus[index]?.valid ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {serialNumberStatus[index].message}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity (Fixed)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value="1"
                      readOnly
                      className="w-full p-2 border rounded-md bg-gray-100 cursor-not-allowed text-gray-500"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Each serial number equals one unit
                  </p>
                </div>
                
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={entry.date}
                    onChange={(e) => handleStockEntryChange(index, 'date', e.target.value)}
                    className="w-full p-2 border rounded-md bg-white"
                    required
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 mb-6">
          <button
            type="button"
            onClick={handleAddStockEntry}
            className="flex items-center text-indigo-600 hover:text-indigo-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Another Serial Number
          </button>
        </div>
        
        <div className="mt-6 pt-4 border-t flex justify-between">
          <div>
            <span className="text-sm text-gray-500">
              {stockEntries.filter(e => serialNumberStatus[stockEntries.indexOf(e)]?.valid).length} valid serial numbers
            </span>
          </div>
          <div className="flex">
            <button
              type="button"
              onClick={handleDiscardAndClose}
              className="mr-4 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            >
              Discard & Close
            </button>
            
            <button
      type="button"
      onClick={prepareForSaving}
      disabled={loading || stockEntries.every(e => !e.serialNumber.trim() || serialNumberStatus[stockEntries.indexOf(e)]?.valid === false)}
      className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 focus:outline-none disabled:opacity-50"
    >
      <span className="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Prepare to Save
      </span>
    </button>
          </div>

        </div>
      </div>
    );
  };

  // Form for adding generic product stock
const GenericStockForm = ({ item, onClose, showNotification, onSuccess, onPrepareForSaving  }) => {
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [stockEntries, setStockEntries] = useState([
      {
        quantity: 1,
        date: new Date().toISOString().split('T')[0]
      }
    ]);
    const [stockEntriesToSave, setStockEntriesToSave] = useState([]);

    // Add a function to handle cancellation of the save dialog


    // Reset stock entries form
    const resetStockEntriesForm = () => {
      setStockEntries([
        {
          quantity: 1,
          date: new Date().toISOString().split('T')[0]
        }
      ]);
      setError(null);
      setStockEntriesToSave([]);
    };
  
    // Discard and close button handler
    const handleDiscardAndClose = () => {
      if (stockEntries.some(entry => entry.quantity > 1)) {
        // Confirm before discarding
        if (window.confirm('All unsaved changes will be lost. Are you sure you want to discard them?')) {
          resetStockEntriesForm();
          onClose();
        }
      } else {
        resetStockEntriesForm();
        onClose();
      }
    };
  
    // Add a new stock entry
    const handleAddStockEntry = () => {
      setStockEntries([
        ...stockEntries,
        {
          quantity: 1,
          date: new Date().toISOString().split('T')[0]
        }
      ]);
    };
    
    // Remove a stock entry
    const handleRemoveStockEntry = (index) => {
      const updatedEntries = stockEntries.filter((_, i) => i !== index);
      setStockEntries(updatedEntries);
    };
    
    // Handle input change for stock entries
    const handleStockEntryChange = (index, field, value) => {
      const updatedEntries = [...stockEntries];
      updatedEntries[index][field] = value;
      setStockEntries(updatedEntries);
    };
  
    const prepareForSaving = () => {
      // Validate quantities
      const validEntries = stockEntries
        .filter(entry => entry.quantity > 0)
        .map(entry => ({
          ...entry,
          serialNumber: '' // No serial number for generic products
        }));
      
      if (validEntries.length === 0) {
        setError('No valid quantities to save');
        showNotification('error', 'No valid quantities to save');
        return;
      }
      
      // Call parent component function instead of showing modal
      onPrepareForSaving(validEntries, item);
    };
  
  
    return (
      <div>
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        <div className="mb-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Quantity Entry</h3>
          </div>
          <p className="text-sm text-gray-500">
            Add quantities of items to inventory. Each entry will be added as a separate stock entry.
          </p>
        </div>
        
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {stockEntries.map((entry, index) => (
            <div 
              key={index} 
              className="p-4 border rounded-md bg-gray-50"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Entry #{index + 1}</h3>
                {stockEntries.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStockEntry(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  value={entry.quantity}
                  onChange={(e) => handleStockEntryChange(index, 'quantity', e.target.value)}
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter quantity"
                  min="1"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter the number of {item.unit?.toLowerCase() || 'units'} to add
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={entry.date}
                  onChange={(e) => handleStockEntryChange(index, 'date', e.target.value)}
                  className="w-full p-2 border rounded-md bg-white"
                  required
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 mb-6">
        <button
          type="button"
          onClick={handleAddStockEntry}
          className="flex items-center text-indigo-600 hover:text-indigo-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Another Entry
        </button>
      </div>
      
      <div className="mt-6 pt-4 border-t flex justify-between">
  <div>
    <span className="text-sm text-gray-500">
      Total: {stockEntries.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0)} {item.unit || 'units'}
    </span>
  </div>
  <div className="flex">
    <button
      type="button"
      onClick={handleDiscardAndClose}
      className="mr-4 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
    >
      Discard & Close
    </button>
    
    <button
      type="button"
      onClick={prepareForSaving}
      disabled={loading || stockEntries.every(e => !e.quantity || e.quantity <= 0)}
      className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-500 hover:bg-teal-600 focus:outline-none disabled:opacity-50"
    >
      <span className="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Prepare to Save
      </span>
    </button>
  </div>
  
</div>
    </div>
  );
};


// Add this component at the end of your file (before export default)
const ClickableTableRow = ({ item, index, user, handleDeleteItem, getItemTypeDisplay, getStockDisplay, openViewStockModal, openAddStockModal,  isExpanded, toggleExpanded }) => {
  // const [expanded, setExpanded] = useState(false);
  
  return (
    <React.Fragment>
      <tr 
        className="hover:bg-gray-50 cursor-pointer"
        onClick={toggleExpanded}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-medium">
            {index + 1}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            item.itemType === 'serialized' 
              ? 'bg-blue-100 text-blue-800' 
              : item.itemType === 'generic'
                ? 'bg-green-100 text-green-800'
                : 'bg-purple-100 text-purple-800'
          }`}>
            {getItemTypeDisplay(item.itemType)}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {item.branch?.name || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unit || '-'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{item.salePrice}</td>
        {user.role === 'admin' && (
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{item.purchasePrice || '-'}</td>
        )}
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {item.itemType !== 'service' ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {getStockDisplay(item)} {item.unit || ''}
            </span>
          ) : (
            '-'
          )}
        </td>
        {/* <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <div className="flex space-x-2">
            {user.role === 'manager' && item.itemType !== 'service' && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  openAddStockModal();
                }}
                className="text-blue-600 hover:text-blue-900"
                title="Add Stock"
              >
                <FiPlus size={18} />
              </button>
            )}
            {user.role === 'admin' && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteItem(item.id);
                }}
                className="text-red-600 hover:text-red-900"
                title="Delete Item"
              >
                <FiTrash size={18} />
              </button>
            )}
          </div>
        </td> */}
      </tr>
      
      {/* Expandable row for action buttons */}
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={user.role === 'admin' ? 9 : 8} className="px-6 py-4 border-b">
            <div className="flex space-x-3">
              {item.itemType !== 'service' && (
                <button
                  onClick={() => openViewStockModal()}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  View Details
                </button>
              )}
              
              {user.role === 'manager' && item.itemType !== 'service' && (
                <button
                  onClick={() => openAddStockModal()}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-500 hover:bg-teal-600"
                >
                  Add Stock
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};

export default AllInventoryItems;