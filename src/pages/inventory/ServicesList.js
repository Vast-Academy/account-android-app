import React, { useState, useEffect } from 'react';
import { FiTrash, FiSearch } from 'react-icons/fi';
import SummaryApi from '../../common';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

const ServicesList = ({ searchTerm = '' }) => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // const [searchTerm, setSearchTerm] = useState('');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmData, setConfirmData] = useState({
    title: '',
    message: '',
    type: 'warning',
    confirmText: 'Confirm',
    onConfirm: () => {}
  });
  
  // Fetch services
  useEffect(() => {
    fetchServices();
  }, []);
  
  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${SummaryApi.getInventoryByType.url}/service`, {
        method: SummaryApi.getInventoryByType.method,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setServices(data.items);
      } else {
        setError(data.message || 'Failed to fetch services');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error fetching services:', err);
    } finally {
      setLoading(false);
    }
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

  // Delete a service (admin only)
  const handleDeleteService = async (id) => {
    showConfirmation(
      'Delete Service',
      'Are you sure you want to delete this service? This action cannot be undone.',
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
            setServices(services.filter(service => service.id !== id));
            showNotification('success', 'Service deleted successfully');
          } else {
            showNotification('error', data.message || 'Failed to delete service');
            setError(data.message || 'Failed to delete service');
          }
        } catch (err) {
          showNotification('error', 'Server error. Please try again later.');
          setError('Server error. Please try again later.');
          console.error('Error deleting service:', err);
        }
      }
    );
  };
  
  // Filter services based on search term
  const filteredServices = services.filter(
    service => service.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div>
      {/* <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Services</h1>
        <p className="text-gray-600">View available services</p>
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
            placeholder="Search services..."
            className="pl-10 pr-4 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div> */}
      
      {/* Services List */}
      <div className="bg-white rounded-lg overflow-hidden">
        {/* <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-700">Available Services</h2>
        </div> */}
        
        {filteredServices.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {services.length === 0 ? 'No services found.' : 'No services match your search.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  {user.role === 'admin' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase Price</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredServices.map((service, index) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
          <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-medium">
            {index + 1}
          </div>
        </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{service.name}</td>
                    {user.role === 'admin' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{service.purchasePrice || '-'}</td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{service.salePrice}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex space-x-2">
                        {user.role === 'admin' && (
                          <button 
                            onClick={() => handleDeleteService(service.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Service"
                          >
                            <FiTrash size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
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
    </div>
  );
};

export default ServicesList;