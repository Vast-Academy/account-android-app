import React, { useState, useEffect, useRef } from 'react';
import { FiPlus, FiMinus, FiX, FiSearch } from 'react-icons/fi';
import Modal from '../../components/Modal';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useNotification } from '../../context/NotificationContext';

const UnifiedInventoryAssignmentModal = ({ isOpen, onClose, technician, onSuccess }) => {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [serializedProducts, setSerializedProducts] = useState([]);
  const [genericProducts, setGenericProducts] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const searchInputRef = useRef(null);
  const serialInputRef = useRef(null);

  // Add states for dropdown
  const [matchingSerialNumbers, setMatchingSerialNumbers] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Fetch all inventory products
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    } else {
      // Reset when modal closes
      setSelectedItems([]);
      setSearchTerm('');
      setSerialNumber('');
      setShowConfirmation(false);
      setMatchingSerialNumbers([]);
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  // Add effect to filter serial numbers as user types
   // Filter serial numbers as user types
   useEffect(() => {
    if (serialNumber.trim().length > 0) {
      // Get all serial numbers from serialized products
      const allSerialNumbers = [];
      serializedProducts.forEach(product => {
        if (product.stock && Array.isArray(product.stock)) {
          product.stock.forEach(stockItem => {
            if (stockItem.serialNumber && 
                stockItem.serialNumber.toLowerCase().includes(serialNumber.toLowerCase())) {
              allSerialNumbers.push({
                serialNumber: stockItem.serialNumber,
                productId: product.id,
                productName: product.name
              });
            }
          });
        }
      });
      
      setMatchingSerialNumbers(allSerialNumbers);
      setIsDropdownOpen(allSerialNumbers.length > 0);
      setHighlightedIndex(allSerialNumbers.length > 0 ? 0 : -1);
    } else {
      setMatchingSerialNumbers([]);
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  }, [serialNumber, serializedProducts]);

  // Handle keyboard navigation for dropdown
const handleKeyDown = (e) => {
  if (!isDropdownOpen) {
    if (e.key === 'Enter' && serialNumber.trim()) {
      checkSerialNumber();
    }
    return;
  }
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < matchingSerialNumbers.length - 1 ? prev + 1 : prev
      );
      break;
    case 'ArrowUp':
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
      break;
    case 'Enter':
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < matchingSerialNumbers.length) {
        const selected = matchingSerialNumbers[highlightedIndex];
        handleSelectSerialNumber(selected);
      }
      break;
    case 'Escape':
      setIsDropdownOpen(false);
      break;
    default:
      break;
  }
};


  const fetchProducts = async () => {
    try {
      setLoadingInventory(true);
      setError(null);
      
      // Fetch both types of products
      const serializedResponse = await fetch(`${SummaryApi.getInventoryByType.url}/serialized-product`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const genericResponse = await fetch(`${SummaryApi.getInventoryByType.url}/generic-product`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const serializedData = await serializedResponse.json();
      const genericData = await genericResponse.json();
      
      if (serializedData.success && genericData.success) {
        setSerializedProducts(serializedData.items || []);
        setGenericProducts(genericData.items || []);
      } else {
        setError('Failed to load inventory products');
      }
    } catch (err) {
      setError('Server error while loading products');
      console.error('Error fetching products:', err);
    } finally {
      setLoadingInventory(false);
    }
  };

  // Handle select serial number from suggestions
  const handleSelectSerialNumber = (serialData) => {
    // Find the product
    const product = serializedProducts.find(p => p.id === serialData.productId);
    
    if (product) {
      addSerializedProduct(product, serialData.serialNumber);
      setSerialNumber(''); // Clear input
      setIsDropdownOpen(false); // Close dropdown
      setHighlightedIndex(-1); // Reset highlighted index
      
      // Focus back on the input
      if (serialInputRef.current) {
        serialInputRef.current.focus();
      }
    } else {
      showNotification('error', 'Product not found for this serial number');
    }
  };

  // All products combined (for display)
  const allProducts = [...serializedProducts, ...genericProducts].map(product => ({
    ...product,
    displayType: product.type === 'serialized-product' ? 'Serialized' : 'Generic'
  }));

  // Filter products based on search term
  const filteredProducts = allProducts.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if serial number exists in inventory
  const checkSerialNumber = async () => {
    if (!serialNumber.trim()) return;
    
    try {
      const response = await fetch(`${SummaryApi.checkSerialNumber.url}/${serialNumber.trim()}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.exists) {
        // Find the product with this serial number
        const serializedProduct = serializedProducts.find(p => p.id === data.item.id);
        
        if (serializedProduct) {
          // Add to selected items
          addSerializedProduct(serializedProduct, serialNumber.trim());
          setSerialNumber(''); // Clear input field
        }
      } else {
        showNotification('error', data.message || 'Serial number not found in inventory');
      }
    } catch (err) {
      console.error('Error checking serial number:', err);
      showNotification('error', 'Error checking serial number');
    }
  };

  // Add serialized product with serial number
  const addSerializedProduct = (product, serialNum) => {
    // Check if this serial number is already added
    const exists = selectedItems.some(item => 
      item.type === 'serialized-product' && item.serialNumbers.includes(serialNum)
    );

    if (exists) {
      showNotification('warning', 'This serial number is already added');
      return;
    }

    const existingItem = selectedItems.find(item => item.id === product.id);
    
    if (existingItem) {
      // Update existing item
      setSelectedItems(selectedItems.map(item => 
        item.id === product.id 
          ? { 
              ...item, 
              quantity: item.quantity + 1,
              serialNumbers: [...item.serialNumbers, serialNum]
            } 
          : item
      ));
    } else {
      // Add new item
      setSelectedItems([
        ...selectedItems, 
        { 
          ...product, 
          quantity: 1, 
          serialNumbers: [serialNum]
        }
      ]);
    }
  };

  // Add generic product
  const addGenericProduct = (product) => {
    const existingItem = selectedItems.find(item => item.id === product.id);
    
    if (existingItem) {
      // Update quantity if item already exists
      setSelectedItems(selectedItems.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      // Add new item
      setSelectedItems([
        ...selectedItems, 
        { 
          ...product, 
          quantity: 1, 
          serialNumbers: [] 
        }
      ]);
    }
  };

  // Handle product selection
  const handleSelectProduct = (product) => {
    if (product.type === 'serialized-product') {
      // For serialized products, show notification to enter serial number
      showNotification('info', 'Please enter or scan a serial number for this product');
    } else {
      // For generic products, add directly
      addGenericProduct(product);
    }
  };

  // Remove item from selection
  const removeItem = (id) => {
    setSelectedItems(selectedItems.filter(item => item.id !== id));
  };

  // Update item quantity (generic only)
  const updateQuantity = (id, newQuantity) => {
    const product = selectedItems.find(item => item.id === id);
    
    if (!product) return;
    
    // For serialized products, don't update quantity directly
    if (product.type === 'serialized-product') {
      return;
    }

    if (newQuantity <= 0) {
      removeItem(id);
      return;
    }
    
    // Check available stock
    const inventoryProduct = genericProducts.find(p => p.id === id);
    const availableStock = inventoryProduct.stock ? 
      inventoryProduct.stock.reduce((total, item) => total + item.quantity, 0) : 0;
    
    if (newQuantity > availableStock) {
      showNotification('warning', `Only ${availableStock} items available in stock`);
      return;
    }
    
    setSelectedItems(selectedItems.map(item => 
      item.id === id ? { ...item, quantity: newQuantity } : item
    ));
  };

  // Remove a specific serial number
  const removeSerialNumber = (productId, serialNum) => {
    const product = selectedItems.find(item => item.id === productId);
    
    if (!product || product.type !== 'serialized-product') return;
    
    // Remove this serial number
    const updatedSerialNumbers = product.serialNumbers.filter(sn => sn !== serialNum);
    
    if (updatedSerialNumbers.length === 0) {
      // Remove the entire product if no serial numbers left
      removeItem(productId);
    } else {
      // Update with remaining serial numbers
      setSelectedItems(selectedItems.map(item => 
        item.id === productId 
          ? { 
              ...item, 
              quantity: updatedSerialNumbers.length,
              serialNumbers: updatedSerialNumbers
            } 
          : item
      ));
    }
  };

  // Calculate total items
  const totalItems = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  // Handle key press for barcode scanner
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && serialNumber.trim()) {
      checkSerialNumber();
    }
  };

  // Submit and assign inventory
  const handleAssignInventory = async () => {
    if (selectedItems.length === 0) {
      setError('No items selected for assignment');
      return;
    }
    
    try {
      setLoading(true);
      
      // Process each selected item
      for (const item of selectedItems) {
        if (item.type === 'serialized-product') {
          // For serialized products, assign each serial number
          for (const serialNum of item.serialNumbers) {
            await fetch(SummaryApi.assignInventoryToTechnician.url, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                technicianId: technician._id,
                type: 'serialized-product',
                itemId: item.id,
                serialNumber: serialNum,
                quantity: 1
              })
            });
          }
        } else {
          // For generic products, assign with quantity
          await fetch(SummaryApi.assignInventoryToTechnician.url, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              technicianId: technician._id,
              type: 'generic-product',
              itemId: item.id,
              serialNumber: '',
              quantity: item.quantity
            })
          });
        }
      }
      
      showNotification('success', 'Inventory assigned successfully');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error assigning inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  // Focus on search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Inventory to ${technician?.firstName} ${technician?.lastName}`}
      size="xl"
    >
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {loadingInventory ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {/* Main inventory assignment interface */}
          {!showConfirmation && (
            <div className="flex flex-col md:flex-row h-[70vh]">
              {/* Left side - Product list */}
              <div className="w-full md:w-2/3 flex flex-col border-r">
                <div className="p-4 border-b">
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search product..."
                      className="w-full p-3 border rounded pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <FiSearch className="absolute left-3 top-[14px] text-gray-400" />
                  </div>
                </div>
                
                <div className="p-4 border-b">
                  <h3 className="font-medium mb-2">Scan Serial Number (for serialized products)</h3>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Enter or scan serial number"
                      className="flex-grow p-2 border rounded"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      onKeyPress={handleKeyDown}
                    />

                    <button
                      type="button"
                      onClick={checkSerialNumber}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                      disabled={!serialNumber.trim()}
                    >
                      Verify
                    </button>

                    {/* Improved dropdown styling */}
                {isDropdownOpen && (
                  <div className="absolute z-10 w-96 mt-10 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {matchingSerialNumbers.map((item, index) => (
                      <div 
                        key={index}
                        className={`px-4 py-2 cursor-pointer border-b last:border-b-0 ${
                          highlightedIndex === index ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        }`}
                        onClick={() => handleSelectSerialNumber(item)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                      >
                        <div className="font-medium text-gray-800">{item.serialNumber}</div>
                        <div className="text-xs text-gray-500">{item.productName}</div>
                      </div>
                    ))}
                  </div>
                )}
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <h3 className="font-medium mb-2">Available Products</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {filteredProducts.map(product => {
                      // Calculate available stock
                      const availableStock = product.stock ? 
                        (product.type === 'serialized-product' 
                          ? product.stock.length 
                          : product.stock.reduce((total, item) => total + item.quantity, 0)
                        ) : 0;
                      
                      return (
                        <div 
                          key={product.id} 
                          className="border p-3 rounded hover:bg-gray-50 cursor-pointer"
                          onClick={() => handleSelectProduct(product)}
                        >
                          <div className="flex justify-between">
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-gray-500">
                                Type: {product.displayType} | Unit: {product.unit || 'N/A'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold">₹{product.salePrice}</div>
                              <div className="text-sm text-gray-500">
                                Available: {availableStock} {product.unit || 'units'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {filteredProducts.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        No products found. Try a different search term.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Right side - Selected items */}
              <div className="w-full md:w-1/3 flex flex-col">
                <div className="p-4 bg-gray-50 border-b">
                  <h3 className="font-bold">Selected Items ({totalItems})</h3>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto">
                  {selectedItems.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      No items selected. Search and select products or scan serial numbers.
                    </div>
                  ) : (
                    selectedItems.map(item => (
                      <div key={item.id} className="mb-4 border-b pb-2">
                        <div className="flex justify-between">
                          <div className="font-medium">{item.name}</div>
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <FiX className="w-5 h-5" />
                          </button>
                        </div>
                        
                        <div className="text-sm text-gray-500">
                          Type: {item.type === 'serialized-product' ? 'Serialized' : 'Generic'}
                        </div>
                        
                        {/* For serialized products, show serial numbers */}
                        {item.type === 'serialized-product' && (
                          <div className="mt-2">
                            <div className="text-sm font-medium">Serial Numbers:</div>
                            {item.serialNumbers.map(sn => (
                              <div key={sn} className="flex justify-between items-center text-sm mt-1">
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                  {sn}
                                </span>
                                <button 
                                  onClick={() => removeSerialNumber(item.id, sn)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <FiX className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* For generic products, show quantity controls */}
                        {item.type === 'generic-product' && (
                          <div className="mt-2 flex items-center">
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-l flex items-center justify-center"
                            >
                              <FiMinus />
                            </button>
                            <input 
                              type="number" 
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                              className="w-12 h-8 text-center border-t border-b"
                            />
                            <button 
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-r flex items-center justify-center"
                            >
                              <FiPlus />
                            </button>
                            <span className="ml-2 text-sm text-gray-500">
                              {item.unit || 'units'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                
                <div className="p-4 border-t bg-gray-50">
                  <button
                    onClick={() => setShowConfirmation(true)}
                    disabled={selectedItems.length === 0}
                    className={`w-full py-2 rounded-md ${
                      selectedItems.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    Proceed to Verification
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Confirmation view */}
          {showConfirmation && (
            <div className="p-4">
              <h3 className="text-lg font-bold mb-4">Confirm Inventory Assignment</h3>
              <p className="mb-4">
                You are about to assign {totalItems} items to {technician?.firstName} {technician?.lastName}.
                Please verify the details before confirming.
              </p>
              
              <div className="border rounded mb-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedItems.map(item => (
                      <tr key={item.id}>
                        <td className="px-4 py-2">{item.name}</td>
                        <td className="px-4 py-2">
                          {item.type === 'serialized-product' ? 'Serialized' : 'Generic'}
                        </td>
                        <td className="px-4 py-2 text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">
                          {item.type === 'serialized-product' 
                            ? <span className="text-blue-600">{item.serialNumbers.length} Serial Numbers</span>
                            : <span>{item.unit || 'units'}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
                >
                  Back
                </button>
                <button
                  onClick={handleAssignInventory}
                  disabled={loading}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
                >
                  {loading ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export default UnifiedInventoryAssignmentModal;