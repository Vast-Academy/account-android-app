import React, { useState, useEffect, useRef } from 'react';
import { FiPlus, FiTrash, FiSearch, FiCamera, FiSave } from 'react-icons/fi';
import Modal from '../../components/Modal';
import SummaryApi from '../../common';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

const SerializedProductsList = ({ searchTerm = '' }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isViewStockModalOpen, setIsViewStockModalOpen] = useState(false);
  const [selectedStockItem, setSelectedStockItem] = useState(null);
  const [serialNumberStatus, setSerialNumberStatus] = useState({});
  const [stockEntriesToSave, setStockEntriesToSave] = useState([]);
  const [checkingSerial, setCheckingSerial] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({
    title: '',
    message: '',
    type: 'warning',
    confirmText: 'Confirm',
    onConfirm: () => {}
  });
  
   // State to track which row is expanded
    const [expandedRowId, setExpandedRowId] = useState(null);
    const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);


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

  // Stock entries state
  const [stockEntries, setStockEntries] = useState([
    {
      serialNumber: '',
      quantity: 1,
      date: new Date().toISOString().split('T')[0]
    }
  ]);
  const barcodeInputRef = useRef(null);
  
  // Fetch serialized products
  useEffect(() => {
    fetchItems();
  }, []);
  
  // Focus on barcode input when stock modal opens
  useEffect(() => {
    if (!isAddStockModalOpen) {
      const timer = setTimeout(() => {
        resetStockEntriesForm();
        setSerialNumberStatus({});
        setStockEntriesToSave([]);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isAddStockModalOpen]);
  
  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${SummaryApi.getInventoryByType.url}/serialized-product`, {
        method: SummaryApi.getInventoryByType.method,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setItems(data.items);
      } else {
        setError(data.message || 'Failed to fetch serialized products');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error fetching serialized products:', err);
    } finally {
      setLoading(false);
    }
  };

  const openViewStockModal = (item) => {
    setSelectedStockItem(item);
    setIsViewStockModalOpen(true);
  };
  
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

  // Discard and close button handler
  const handleDiscardAndClose = () => {
    if (stockEntries.some(entry => entry.serialNumber.trim() !== '')) {
      showConfirmation(
        'Discard Changes?',
        'All unsaved changes will be lost. Are you sure you want to discard them?',
        'warning',
        'Discard',
        () => {
          resetStockEntriesForm(); 
          setSerialNumberStatus({});
          setStockEntriesToSave([]);
          setIsAddStockModalOpen(false);
        }
      );
    } else {
      resetStockEntriesForm();
      setSerialNumberStatus({});
      setStockEntriesToSave([]);
      setIsAddStockModalOpen(false);
    }
  };

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
            setItems(items.filter(item => item.id !== id));
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
  
  // Open add stock modal for an item (manager only)
  const openAddStockModal = (item) => {
    resetStockEntriesForm();
    setSerialNumberStatus({});
    setStockEntriesToSave([]);
    
    setSelectedItem(item);
    setIsAddStockModalOpen(true);
    
    setTimeout(() => {
      const firstInput = document.getElementById('barcode-input-0');
      if (firstInput) {
        firstInput.focus();
      }
    }, 300);
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
    
    setStockEntriesToSave(validEntries);
    // Instead of just showing notification, show the confirmation dialog
    setShowSaveConfirmation(true);
  };

  // 3. Add a function to handle cancellation of the save dialog
const handleCancelSave = () => {
  setShowSaveConfirmation(false);
};

  // Save stock entries
  const handleSaveStock = async () => {
    setError(null);
    
    try {
      setLoading(true);
      
      // Submit each stock entry
      for (const entry of stockEntriesToSave) {
        const response = await fetch(SummaryApi.addInventoryStock.url, {
          method: SummaryApi.addInventoryStock.method,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            itemId: selectedItem.id,
            ...entry
          })
        });
        
        const data = await response.json();
        
        if (!data.success) {
          showNotification('error', data.message || 'Failed to add stock');
          setError(data.message || 'Failed to add stock');
          setLoading(false);
          return;
        }
      }
      
      showNotification('success', 'Stock added successfully');
      
      setShowSaveConfirmation(false);
      setIsAddStockModalOpen(false);
      resetStockEntriesForm();
      fetchItems();
    } catch (err) {
      showNotification('error', 'Server error. Please try again later.');
      setError('Server error. Please try again later.');
      console.error('Error adding stock:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Filter items based on search term
  const filteredItems = items.filter(
    item => item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div>
      {/* <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Serialized Products</h1>
        <p className="text-gray-600">Manage products with serial numbers</p>
      </div> */}
      
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
          <h2 className="text-lg font-semibold text-gray-700">Serialized Products</h2>
        </div> */}
        
        {filteredItems.length === 0 ? (
  <div className="p-6 text-center text-gray-500">
    {items.length === 0 ? 'No serialized products found.' : 'No products match your search.'}
  </div>
) : (
  <div className="overflow-x-auto">
  <table className="w-full">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.NO</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NAME</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">BRANCH</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">UNIT</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WARRANTY</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MRP</th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SALE PRICE</th>
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
          openViewStockModal={openViewStockModal}
          openAddStockModal={openAddStockModal}
          isExpanded={expandedRowId === item.id}
          toggleExpanded={() => toggleRowExpansion(item.id)}
        />
      ))}
    </tbody>
  </table>
</div>
)}
      </div>
      
      {/* Add Stock Modal - For managers only */}
      <Modal
        isOpen={isAddStockModalOpen}
        onClose={() => handleDiscardAndClose()}
        title={`Add Stock for ${selectedItem?.name || ''}`}
        size="lg"
      >
        {selectedItem && (
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
                  <FiCamera className="text-gray-400" />
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
                        <FiTrash size={18} />
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
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </div>
                        )}
                        {serialNumberStatus[index]?.valid === true && !checkingSerial && (
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                            <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                          </div>
                        )}
                        {serialNumberStatus[index]?.valid === false && !checkingSerial && (
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                            <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
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
                <FiPlus className="mr-1" />
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
      className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
    >
      <span className="flex items-center">
        <FiSave className="mr-2" />
        Prepare to Save
      </span>
          </button>
              </div>
            </div>
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
              <h3 className="text-lg font-medium text-gray-900">Serial Numbers</h3>
              <p className="text-sm text-gray-500">
                Total Stock: {selectedStockItem.stock ? selectedStockItem.stock.length : 0} {selectedStockItem.unit}
              </p>
            </div>
            
            {selectedStockItem.stock && selectedStockItem.stock.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sr No.</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Added</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedStockItem.stock.map((stockItem, index) => (
                      <tr key={stockItem.serialNumber || index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stockItem.serialNumber}</td>
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

      <Modal
  isOpen={showSaveConfirmation}
  onClose={handleCancelSave}
  title="Confirm Save"
  size="md"
>
  <div className="py-4">
    <div className="mb-6 flex items-center justify-center">
      <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
        <FiSave size={32} className="text-blue-500" />
      </div>
    </div>
    
    <h3 className="text-xl font-medium text-center mb-4">Ready to Save</h3>
    
    <p className="text-center text-gray-600 mb-6">
      You are about to save <span className="font-bold">{stockEntriesToSave.length}</span> serial number{stockEntriesToSave.length !== 1 ? 's' : ''} for item <span className="font-bold">{selectedItem?.name}</span>.
    </p>
    
    <div className="mt-8 flex justify-center space-x-4">
      <button
        type="button"
        onClick={handleCancelSave}
        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSaveStock}
        disabled={loading}
        className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Saving...
          </span>
        ) : (
          <span className="flex items-center">
            <FiSave className="mr-2" />
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

const ClickableTableRow = ({ item, index, user, openViewStockModal, openAddStockModal, isExpanded,
  toggleExpanded }) => {
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
          {item.branch?.name || '-'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unit}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.warranty || 'No Warranty'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{item.mrp}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{item.salePrice}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {item.stock ? item.stock.length : 0} {item.unit}
          </span>
        </td>
        {/* <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <button 
            className="text-blue-600 hover:text-blue-900"
            onClick={(e) => {
              e.stopPropagation();
              user.role === 'manager' ? openAddStockModal(item) : openViewStockModal(item);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </td> */}
      </tr>
      
      {/* Expandable row for action buttons */}
      {isExpanded && (
        <tr className="bg-gray-50">
          <td colSpan={9} className="px-6 py-4 border-b">
            <div className="flex space-x-3">
              <button
                onClick={() => openViewStockModal(item)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                View Details
              </button>
              
              {user.role === 'manager' && (
                <button
                  onClick={() => openAddStockModal(item)}
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

export default SerializedProductsList;