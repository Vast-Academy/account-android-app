import React, { useState, useEffect } from 'react';
import { FiSave, FiX } from 'react-icons/fi';
import Modal from '../../components/Modal';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useNotification } from '../../context/NotificationContext';

const AssignInventoryModal = ({ isOpen, onClose, technician, onSuccess }) => {
  const { showNotification } = useNotification();
  const [inventoryType, setInventoryType] = useState('serialized-product');
  const [loading, setLoading] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [error, setError] = useState(null);
  const [serializedProducts, setSerializedProducts] = useState([]);
  const [genericProducts, setGenericProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [serialNumberStatus, setSerialNumberStatus] = useState(null);
  
  // Fetch inventory products
  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen, inventoryType]);

  // Add this to your component to automatically verify before submitting
useEffect(() => {
  // If the serial number changes, reset the verification status
  if (serialNumber.trim() !== '') {
    setSerialNumberStatus(prev => {
      // Only reset if the previous serial number verification was for a different number
      if (prev && prev.serialNumber !== serialNumber.trim()) {
        return null;
      }
      return prev;
    });
  }
}, [serialNumber]);
  
  const fetchProducts = async () => {
    try {
      setLoadingInventory(true);
      
      // Fetch products based on selected type
      const response = await fetch(`${SummaryApi.getInventoryByType.url}/${inventoryType}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (inventoryType === 'serialized-product') {
          setSerializedProducts(data.items);
        } else {
          setGenericProducts(data.items);
        }
      } else {
        setError('Failed to load products');
      }
    } catch (err) {
      setError('Server error while loading products');
      console.error('Error fetching products:', err);
    } finally {
      setLoadingInventory(false);
    }
  };
  
  // Check if serial number exists in inventory
  const checkSerialNumber = async () => {
    if (!serialNumber.trim()) {
      setSerialNumberStatus({
        valid: false,
        message: 'Please enter a serial number'
      });
      return;
    }
    
    try {
      // Set a loading state for serial number checking
      setSerialNumberStatus({
        valid: null,
        message: 'Verifying...'
      });
      
      const response = await fetch(`${SummaryApi.checkSerialNumber.url}/${serialNumber.trim()}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      console.log("Serial number check response:", data); // Debug logging
      
      if (data.exists) {
        // Serial number found, valid for assignment
        setSerialNumberStatus({
          valid: true,
          item: data.item,
          message: `Valid serial number for: ${data.item.name}`
        });
      } else {
        // Serial number not found
        setSerialNumberStatus({
          valid: false,
          message: data.message || 'Serial number not found in your branch inventory'
        });
      }
    } catch (err) {
      console.error('Error checking serial number:', err);
      setSerialNumberStatus({
        valid: false,
        message: 'Error checking serial number'
      });
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (inventoryType === 'serialized-product') {
      // Check if we have a serial number
      if (!serialNumber.trim()) {
        setError('Please enter a serial number');
        return;
      }
      
      // Check if we need to verify the serial number first
      if (serialNumberStatus === null) {
        // Verify the serial number before submitting
        await checkSerialNumber();
        // Don't proceed further yet - wait for verification to complete
        return;
      }
      
      // Now check if the serial number is valid
      if (!serialNumberStatus?.valid) {
        setError('Please enter a valid serial number from inventory');
        return;
      }
    } else {
      if (!selectedProduct) {
        setError('Please select a product');
        return;
      }
      
      if (!quantity || quantity <= 0) {
        setError('Please enter a valid quantity');
        return;
      }
    }
    
    try {
      setLoading(true);
      
      // Call API to assign inventory to technician
      const response = await fetch(SummaryApi.assignInventoryToTechnician.url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          technicianId: technician._id,
          type: inventoryType,
          itemId: inventoryType === 'serialized-product' ? serialNumberStatus.item.id : selectedProduct,
          serialNumber: inventoryType === 'serialized-product' ? serialNumber : '',
          quantity: inventoryType === 'serialized-product' ? 1 : quantity
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification('success', 'Inventory assigned successfully');
        if (onSuccess) onSuccess(data.data);
        onClose();
      } else {
        setError(data.message || 'Failed to assign inventory');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error assigning inventory:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign Inventory to ${technician?.firstName} ${technician?.lastName}`}
      size="lg"
    >
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="mb-4">
        <h3 className="font-medium text-gray-700">Select Inventory Type:</h3>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="inventoryType"
              value="serialized-product"
              checked={inventoryType === 'serialized-product'}
              onChange={() => setInventoryType('serialized-product')}
              className="h-4 w-4 text-indigo-600"
            />
            <span className="ml-2">Serialized Product</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              name="inventoryType"
              value="generic-product"
              checked={inventoryType === 'generic-product'}
              onChange={() => setInventoryType('generic-product')}
              className="h-4 w-4 text-indigo-600"
            />
            <span className="ml-2">Generic Product</span>
          </label>
        </div>
      </div>
      
      {loadingInventory ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {inventoryType === 'serialized-product' ? (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Serial Number
              </label>
              <div className="flex space-x-2">
                <input
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  onBlur={checkSerialNumber}
                  className="w-full p-2 border rounded"
                  placeholder="Enter or scan serial number"
                />
                <button
                  type="button"
                  onClick={checkSerialNumber}
                  className="px-4 py-2 bg-blue-500 text-white rounded"
                >
                  Verify
                </button>
              </div>
              
              {serialNumberStatus && (
                <div className={`mt-2 p-2 rounded ${
                  serialNumberStatus.valid 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {serialNumberStatus.valid 
                    ? `Valid serial number for: ${serialNumberStatus.item.name}` 
                    : serialNumberStatus.message}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Product
                </label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                >
                  <option value="">Select a generic product</option>
                  {genericProducts.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} - Available: {
                        product.stock 
                          ? product.stock.reduce((total, item) => total + item.quantity, 0) 
                          : 0
                      } {product.unit}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  className="w-full p-2 border rounded"
                  min="1"
                  required
                />
              </div>
            </>
          )}
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Assigning...' : 'Assign Inventory'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default AssignInventoryModal;