import React, { useState, useEffect } from 'react';
import { FiSearch, FiPackage } from 'react-icons/fi';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';

const AssignedInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch technician's assigned inventory
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setLoading(true);
        const response = await fetch(SummaryApi.getTechnicianInventory.url, {
          method: 'GET',
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
          setInventory(data.data);
        } else {
          setError(data.message || 'Failed to fetch inventory');
        }
      } catch (err) {
        setError('Server error. Please try again later.');
        console.error('Error fetching assigned inventory:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInventory();
  }, []);
  
  // Filter inventory based on search term
  const filteredInventory = inventory.filter(item => 
    item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">My Assigned Inventory</h1>
        <p className="text-gray-600">View all inventory items assigned to you</p>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="flex justify-end mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search items..."
            className="pl-10 pr-4 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {inventory.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-gray-500">No inventory items assigned to you yet.</p>
        </div>
      ) : (
        <>
          {/* Serialized Products Section */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-700">Serialized Products</h2>
            </div>
            
            {filteredInventory.filter(item => item.type === 'serialized-product' && item.serializedItems.length > 0).length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No serialized products assigned to you.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInventory
                      .filter(item => item.type === 'serialized-product' && item.serializedItems.length > 0)
                      .flatMap(item => 
                        item.serializedItems.map((serialItem, index) => (
                          <tr key={`${item._id}-${serialItem.serialNumber}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.itemName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{serialItem.serialNumber}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unit}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(serialItem.assignedAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Generic Products Section */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-700">Generic Products</h2>
            </div>
            
            {filteredInventory.filter(item => item.type === 'generic-product' && item.genericQuantity > 0).length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No generic products assigned to you.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInventory
                      .filter(item => item.type === 'generic-product' && item.genericQuantity > 0)
                      .map(item => (
                        <tr key={item._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.itemName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.genericQuantity}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.unit}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(item.lastUpdated).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AssignedInventory;