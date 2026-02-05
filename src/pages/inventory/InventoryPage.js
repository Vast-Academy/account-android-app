import React, { useState, useEffect } from 'react';
import { FiBox, FiX, FiSave, FiSearch } from 'react-icons/fi';
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

const InventoryPage = () => {
  const { showNotification } = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRowId, setExpandedRowId] = useState(null);
const [isEditModalOpen, setIsEditModalOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState(null);
const [lastRefreshTime, setLastRefreshTime] = useState(0);

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

  // Fetch inventory items on component mount
  useEffect(() => {
    fetchInventoryItems();
  }, []);

  // Fetch all inventory items from API
  const fetchInventoryItems = async (forceFresh = false) => {
    try {
      // Check for cached data
      const cachedInventoryItems = localStorage.getItem('inventoryItems');
      
      // Use cached data if available and not forcing fresh data
      if (!forceFresh && cachedInventoryItems) {
        setInventoryItems(JSON.parse(cachedInventoryItems));
        // console.log("Using cached inventory data");
        
        // Fetch fresh data in background
        fetchFreshInventoryInBackground();
        setLoading(false);
        return;
      }
      
      // If no valid cache or force fresh, fetch new data
      setLoading(true);
      await fetchFreshInventoryData();
    } catch (err) {
      // Try to use cached data as fallback if API fails
      const cachedInventoryItems = localStorage.getItem('inventoryItems');
      if (cachedInventoryItems) {
        setInventoryItems(JSON.parse(cachedInventoryItems));
        console.log("Using cached inventory data after fetch error");
      } else {
        showNotification('error', 'Server error. Failed to fetch inventory items.');
        console.error('Error fetching inventory items:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchFreshInventoryInBackground = async () => {
    try {
      await fetchFreshInventoryData(true);
    } catch (err) {
      console.error('Error fetching inventory data in background:', err);
    }
  };

  const fetchFreshInventoryData = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    
    try {
      // सभी तीन प्रकार के इंवेंटरी आइटम्स को पैरेलल में फेच करें
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
      
      // सभी रिस्पॉन्स पार्स करें
      const [serializedData, genericData, servicesData] = await Promise.all([
        serializedResponse.json(),
        genericResponse.json(),
        servicesResponse.json()
      ]);
      
      // सभी आइटम्स को कम्बाइन करें और टाइप प्रॉपर्टी जोड़ें
      const combinedItems = [
        ...(serializedData.success ? serializedData.items : []),
        ...(genericData.success ? genericData.items : []),
        ...(servicesData.success ? servicesData.items : [])
      ];
      
      setInventoryItems(combinedItems);
      
      // Cache the inventory data
      localStorage.setItem('inventoryItems', JSON.stringify(combinedItems));
      
      // Update last refresh time for UI
      setLastRefreshTime(new Date().getTime());
    } catch (err) {
      if (!isBackground) {
        showNotification('error', 'Server error. Failed to fetch inventory items.');
        console.error('Error fetching inventory items:', err);
      }
      throw err;
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
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

// Function to open edit modal
const openEditModal = (item) => {
  setSelectedItem(item);
  setIsEditModalOpen(true);
};

// Add a function to handle the update
const handleUpdateItem = async () => {
  try {
    setLoading(true);
    setError(null);
    
    const response = await fetch(`${SummaryApi.updateInventoryItem.url}/${selectedItem.id}`, {
      method: SummaryApi.updateInventoryItem.method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(selectedItem)
    });
    
    const data = await response.json();
    console.log("check API data:", data);
    
    if (data.success) {
      showNotification('success', 'Item updated successfully');
      setIsEditModalOpen(false);

      // Clear the inventory cache
      localStorage.removeItem('inventoryItems');

      // Update the local state immediately with the new values
      setInventoryItems(prevItems => 
        prevItems.map(item => 
          item.id === selectedItem.id ? {...item, ...selectedItem} : item
        )
      );
      fetchFreshInventoryData(); // Refresh the list
    } else {
      showNotification('error', data.message || 'Failed to update item');
      setError(data.message || 'Failed to update item');
    }
  } catch (err) {
    showNotification('error', 'Server error. Please try again later.');
    setError('Server error. Please try again later.');
    console.error('Error updating item:', err);
  } finally {
    setLoading(false);
  }
};

// Add a function to handle edit form input changes
const handleEditItemChange = (e) => {
  const { name, value } = e.target;
  setSelectedItem({
    ...selectedItem,
    [name]: value
  });
};

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

  // Add a function to fetch the selected item details
const fetchItemDetails = async (itemId) => {
  try {
    setLoading(true);
    const response = await fetch(`${SummaryApi.getInventoryItemById.url}/${itemId}`, {
      method: SummaryApi.getInventoryItemById.method,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      setSelectedItem(data.item);
    } else {
      showNotification('error', data.message || 'Failed to fetch item details');
    }
  } catch (err) {
    showNotification('error', 'Server error. Failed to fetch item details.');
    console.error('Error fetching item details:', err);
  } finally {
    setLoading(false);
  }
};

// Calculate stock display for different item types
const getStockDisplay = (item) => {
  if (item.type === 'serialized-product') {
    return item.stock ? item.stock.length : 0;
  } else if (item.type === 'generic-product') {
    return item.stock ? item.stock.reduce((total, stock) => total + parseInt(stock.quantity, 10), 0) : 0;
  } else {
    return 'N/A'; // Services don't have stock
  }
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
        
        // Reset form and close modal
        setNewItem({
          type: 'serialized-product',
          name: '',
          unit: 'Piece',
          warranty: '1 year',
          mrp: '',
          purchasePrice: '',
          salePrice: ''
        });
        setIsModalOpen(false);

         // Clear the inventory cache
      localStorage.removeItem('inventoryItems');
        
        // Refresh inventory items
        fetchFreshInventoryData();
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

  // Filter items based on active filter
  const filteredItems = inventoryItems.filter(item => {
    // First apply type filter
    if (activeFilter !== 'All') {
      // Convert from filter button names to actual type values in data
      const filterTypeMap = {
        'Serialized': 'serialized-product',
        'Generic': 'generic-product',
        'Services': 'service'
      };
      
      if (item.type !== filterTypeMap[activeFilter]) {
        return false;
      }
    }
    
    // Then apply search term filter
    if (searchTerm) {
      return item.name.toLowerCase().includes(searchTerm.toLowerCase());
    }
    
    return true;
  });

  // Get display type value
  const getDisplayType = (type) => {
    switch(type) {
      case 'serialized-product':
        return 'Serialized Product';
      case 'generic-product':
        return 'Generic Product';
      case 'service':
        return 'Service';
      default:
        return type;
    }
  };

  return (
    <div className="container mx-auto">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Inventory</h1>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-2">
    {/* Add Inventory Button */}
    <button 
      onClick={() => setIsModalOpen(true)}
      className="flex items-center px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors"
    >
      <FiBox className="mr-2" />
      Add Inventory
    </button>
    
    {/* Add Refresh Button */}
    <button 
      onClick={() => fetchFreshInventoryData()}
      className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700"
      title="Refresh Inventory"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
      </svg>
    </button>
  </div>
          
          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setActiveFilter('All')}
              className={`px-4 py-2 ${activeFilter === 'All' ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-800'} rounded-full text-sm hover:bg-teal-600 hover:text-white transition-colors`}
            >
              All
            </button>
            <button 
              onClick={() => setActiveFilter('Serialized')}
              className={`px-4 py-2 ${activeFilter === 'Serialized' ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-800'} rounded-full text-sm hover:bg-teal-600 hover:text-white transition-colors`}
            >
              Serialized
            </button>
            <button 
              onClick={() => setActiveFilter('Generic')}
              className={`px-4 py-2 ${activeFilter === 'Generic' ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-800'} rounded-full text-sm hover:bg-teal-600 hover:text-white transition-colors`}
            >
              Generic
            </button>
            <button 
              onClick={() => setActiveFilter('Services')}
              className={`px-4 py-2 ${activeFilter === 'Services' ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-800'} rounded-full text-sm hover:bg-teal-600 hover:text-white transition-colors`}
            >
              Services
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <FiSearch className="text-gray-400" />
          </div>
          <input 
            type="search" 
            className="w-full pl-10 pr-4 py-2 border rounded-lg" 
            placeholder="Search items..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        {/* Inventory Items Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="text-left bg-gray-100">
                <th className="px-4 py-3 text-xs text-gray-600 font-medium">S.NO</th>
                <th className="px-4 py-3 text-xs text-gray-600 font-medium">NAME</th>
                <th className="px-4 py-3 text-xs text-gray-600 font-medium">TYPE</th>
                <th className="px-4 py-3 text-xs text-gray-600 font-medium">UNIT</th>
                <th className="px-4 py-3 text-xs text-gray-600 font-medium">WARRANTY</th>
                <th className="px-4 py-3 text-xs text-gray-600 font-medium">MRP</th>
                <th className="px-4 py-3 text-xs text-gray-600 font-medium">PURCHASE PRICE</th>
                <th className="px-4 py-3 text-xs text-gray-600 font-medium">SALE PRICE</th>
                <th className="px-4 py-3 text-xs text-gray-600 font-medium">STOCK</th>
              </tr>
            </thead>
            <tbody>
  {filteredItems.map((item, index) => (
    <React.Fragment key={item.id}>
      <tr 
        className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 cursor-pointer`}
        onClick={() => toggleRowExpansion(item.id)}
      >
        <td className="px-4 py-3 border-t">
          <div className="flex items-center justify-center w-8 h-8 bg-teal-500 text-white rounded-full">
            {index + 1}
          </div>
        </td>
        <td className="px-4 py-3 border-t">{item.name}</td>
        <td className="px-4 py-3 border-t">
          <span className={`px-2 py-1 rounded text-xs ${
            item.type === 'serialized-product' ? 'bg-blue-100 text-blue-800' : 
            item.type === 'generic-product' ? 'bg-green-100 text-green-800' : 
            'bg-purple-100 text-purple-800'
          }`}>
            {getDisplayType(item.type)}
          </span>
        </td>
        <td className="px-4 py-3 border-t">{item.unit || 'N/A'}</td>
        <td className="px-4 py-3 border-t">{item.warranty || 'N/A'}</td>
        <td className="px-4 py-3 border-t">{item.mrp || 'N/A'}</td>
        <td className="px-4 py-3 border-t">{item.purchasePrice || 'N/A'}</td>
        <td className="px-4 py-3 border-t">₹{item.salePrice}</td>
        <td className="px-4 py-3 border-t">
          {item.type !== 'service' ? (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {item.totalStock !== undefined ? item.totalStock : getStockDisplay(item)} {item.unit}
            </span>
          ) : (
            'N/A'
          )}
        </td>
      </tr>
      
      {/* Expandable row for action buttons */}
      {expandedRowId === item.id && (
        <tr className="bg-gray-50">
          <td colSpan={9} className="px-6 py-4 border-b">
            <div className="flex space-x-3">
              <button
                onClick={() => openEditModal(item)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-500 hover:bg-teal-600"
              >
                <FiSave className="mr-2" />
                Edit Item
              </button>
              <button
                onClick={() => openEditModal(item)}
                className="inline-flex items-center px-4 py-2 border border-teal-500 rounded-md shadow-sm text-sm font-medium text-teal-500 bg-white hover:bg-teal-500 hover:text-white"
              >
                <FiSave className="mr-2" />
                Add Stock
              </button>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  ))}
  {filteredItems.length === 0 && (
    <tr>
      <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
        {loading ? 'Loading inventory items...' : 'No inventory items found'}
      </td>
    </tr>
  )}
</tbody>
          </table>
        </div>
      </div>
      
      {/* Add Inventory Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white max-h-[600px] overflow-y-auto rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between bg-gray-100 px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-800">Add New Inventory Item</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <FiX size={24} />
              </button>
            </div>
            
            <div className="p-6">
              {error && (
                <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
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
                        className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
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
                        className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
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
                        className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
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
                        className="w-full p-2 border rounded-md bg-white"
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
                        className="w-full p-2 border rounded-md bg-white"
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
              </div>
            </div>
            
            <div className="bg-gray-100 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={loading}
                className="inline-flex justify-center items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none disabled:opacity-50"
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
                    Save Item
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Inventory Modal */}
{isEditModalOpen && selectedItem && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white max-h-[600px] overflow-y-auto rounded-lg shadow-xl w-full max-w-2xl">
      <div className="flex items-center justify-between bg-gray-100 px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-800">Edit Item: {selectedItem.name}</h2>
        <button 
          onClick={() => setIsEditModalOpen(false)}
          className="text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          <FiX size={24} />
        </button>
      </div>
      
      <div className="p-6">
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item Type
            </label>
            <div className="grid grid-cols-3 gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="serialized-product"
                  checked={selectedItem.type === 'serialized-product'}
                  onChange={handleEditItemChange}
                  disabled={selectedItem.type === 'serialized-product' || selectedItem.type === 'generic-product'}
                  className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                />
                <span className="ml-2">Serialized Product</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="generic-product"
                  checked={selectedItem.type === 'generic-product'}
                  onChange={handleEditItemChange}
                  disabled={selectedItem.type === 'serialized-product' || selectedItem.type === 'generic-product'}
                  className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                />
                <span className="ml-2">Generic Product</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="service"
                  checked={selectedItem.type === 'service'}
                  onChange={handleEditItemChange}
                  disabled={selectedItem.type === 'serialized-product' || selectedItem.type === 'generic-product'}
                  className="h-4 w-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                />
                <span className="ml-2">Service</span>
              </label>
            </div>
            {(selectedItem.type === 'serialized-product' || selectedItem.type === 'generic-product') && (
              <p className="mt-1 text-xs text-gray-500">
                Product type cannot be changed after creation
              </p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={selectedItem.name}
              onChange={handleEditItemChange}
              readOnly={selectedItem.type === 'serialized-product' || selectedItem.type === 'generic-product'}
              className={`w-full p-2 border rounded-md ${
                (selectedItem.type === 'serialized-product' || selectedItem.type === 'generic-product') 
                ? 'bg-gray-200 cursor-not-allowed' : ''
              }`}
              placeholder="Item name"
              disabled
            />
            {(selectedItem.type === 'serialized-product' || selectedItem.type === 'generic-product') && (
              <p className="mt-1 text-xs text-gray-500">
                Product name cannot be changed after creation
              </p>
            )}
          </div>
          
          {(selectedItem.type === 'serialized-product' || selectedItem.type === 'generic-product') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Unit
                </label>
                <select
                  name="unit"
                  value={selectedItem.unit}
                  onChange={handleEditItemChange}
                  className="w-full p-2 border rounded-md bg-white"
                >
                  {productUnits.map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Warranty
                </label>
                <select
                  name="warranty"
                  value={selectedItem.warranty}
                  onChange={handleEditItemChange}
                  className="w-full p-2 border rounded-md bg-white"
                >
                  {warrantyOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MRP (₹)
                </label>
                <input
                  type="number"
                  name="mrp"
                  value={selectedItem.mrp}
                  onChange={handleEditItemChange}
                  className="w-full p-2 border rounded-md"
                  placeholder="MRP"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Purchase Price (₹)
                </label>
                <input
                  type="number"
                  name="purchasePrice"
                  value={selectedItem.purchasePrice}
                  onChange={handleEditItemChange}
                  className="w-full p-2 border rounded-md"
                  placeholder="Purchase Price"
                />
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sale Price (₹)
            </label>
            <input
              type="number"
              name="salePrice"
              value={selectedItem.salePrice}
              onChange={handleEditItemChange}
              className="w-full p-2 border rounded-md"
              placeholder="Sale Price"
            />
          </div>
        </div>
      </div>
      
      <div className="bg-gray-100 px-6 py-4 flex justify-end space-x-3">
        <button
          onClick={() => setIsEditModalOpen(false)}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none"
        >
          Cancel
        </button>
        <button
          onClick={handleUpdateItem}
          disabled={loading}
          className="inline-flex justify-center items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating...
            </span>
          ) : (
            <span className="flex items-center">
              <FiSave className="mr-2" />
              Update Item
            </span>
          )}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default InventoryPage;