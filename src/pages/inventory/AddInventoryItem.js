import React, { useState } from 'react';
import { FiSave } from 'react-icons/fi';
import SummaryApi from '../../common';
import { useNotification } from '../../context/NotificationContext';

// Sample product units for selection
const productUnits = [
  'Piece', 'Kg', 'Meter', 'Liter', 'Box', 'Carton', 'Dozen', 'Pair'
];

// Warranty options
const warrantyOptions = [
  'No Warranty', '1 day', '6 months', '1 year', '1.5 years', '2 years', '3 years', '5 years'
];

const AddInventoryItem = () => {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // New item form state
  const [newItem, setNewItem] = useState({
    type: 'serialized-product',
    name: '',
    unit: 'Piece',
    warranty: '1 year',
    mrp: '',
    purchasePrice: '',
    salePrice: ''
  });

  // Handle input change for new item form
  const handleItemInputChange = (e) => {
    const { name, value } = e.target;
    setNewItem({
      ...newItem,
      [name]: value
    });
  };

  // Validate new item form
  const validateNewItemForm = () => {
    setError(null);
    
    if (!newItem.name.trim()) {
      setError('Item name is required');
      return false;
    }
    
    if ((newItem.type === 'serialized-product' || newItem.type === 'generic-product') && !newItem.mrp) {
      setError('MRP is required for products');
      return false;
    }
    
    if ((newItem.type === 'serialized-product' || newItem.type === 'generic-product') && !newItem.purchasePrice) {
      setError('Purchase price is required for products');
      return false;
    }
    
    if (!newItem.salePrice) {
      setError('Sale price is required');
      return false;
    }
    
    return true;
  };

  // Add new inventory item
  const handleAddItem = async () => {
    if (!validateNewItemForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Generate a unique ID for the item
      const uniqueId = `ITEM-${Date.now()}`;
      
      const response = await fetch(SummaryApi.addInventoryItem.url, {
        method: SummaryApi.addInventoryItem.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newItem,
          id: uniqueId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification('success', 'Item added successfully');
        
        // Reset form
        setNewItem({
          type: 'serialized-product',
          name: '',
          unit: 'Piece',
          warranty: '1 year',
          mrp: '',
          purchasePrice: '',
          salePrice: ''
        });
      } else {
        showNotification('error', data.message || 'Failed to add inventory item');
        setError(data.message || 'Failed to add inventory item');
      }
    } catch (err) {
      showNotification('error', 'Server error. Please try again later.');
      setError('Server error. Please try again later.');
      console.error('Error adding inventory item:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Add New Inventory Item</h1>
        <p className="text-gray-600">Create a new product or service</p>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item Type *
            </label>
            <div className="grid grid-cols-3 gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="serialized-product"
                  checked={newItem.type === 'serialized-product'}
                  onChange={handleItemInputChange}
                  className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="ml-2">Serialized Product</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="generic-product"
                  checked={newItem.type === 'generic-product'}
                  onChange={handleItemInputChange}
                  className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="ml-2">Generic Product</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="service"
                  checked={newItem.type === 'service'}
                  onChange={handleItemInputChange}
                  className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="ml-2">Service</span>
              </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name *
            </label>
            <input
              type="text"
              name="name"
              value={newItem.name}
              onChange={handleItemInputChange}
              className="w-full p-2 border rounded-md"
              placeholder="Item name"
              required
            />
          </div>
          
          {(newItem.type === 'serialized-product' || newItem.type === 'generic-product') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit *
                </label>
                <select
                  name="unit"
                  value={newItem.unit}
                  onChange={handleItemInputChange}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  {productUnits.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Warranty *
                </label>
                <select
                  name="warranty"
                  value={newItem.warranty}
                  onChange={handleItemInputChange}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  {warrantyOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MRP (₹) *
                </label>
                <input
                  type="number"
                  name="mrp"
                  value={newItem.mrp}
                  onChange={handleItemInputChange}
                  className="w-full p-2 border rounded-md"
                  placeholder="MRP"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Purchase Price (₹) *
                </label>
                <input
                  type="number"
                  name="purchasePrice"
                  value={newItem.purchasePrice}
                  onChange={handleItemInputChange}
                  className="w-full p-2 border rounded-md"
                  placeholder="Purchase Price"
                  required
                />
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sale Price (₹) *
            </label>
            <input
              type="number"
              name="salePrice"
              value={newItem.salePrice}
              onChange={handleItemInputChange}
              className="w-full p-2 border rounded-md"
              placeholder="Sale Price"
              required
            />
          </div>
          
          <div className="pt-4">
            <button
              type="button"
              onClick={handleAddItem}
              disabled={loading}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center">
                  <FiSave className="mr-2" />
                  Save Item
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddInventoryItem;