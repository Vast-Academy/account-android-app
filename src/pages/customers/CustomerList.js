import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiPlusCircle, FiFilter, FiRefreshCw, FiUserPlus } from 'react-icons/fi';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal'; 
import AddContactForm from '../leads/AddContactForm';
import CustomerDetailModal from '../leads/CustomerDetailModal';
import WorkOrderModal from '../customers/WorkOrderModal';

// Customer styling
const customerColor = 'border-blue-500 bg-blue-50';

const CustomerList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({
    convertedOnly: false
  });
  
  // State for modals
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [showCustomerDetailModal, setShowCustomerDetailModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const handleRowClick = (customerId) => {
    setExpandedRow(expandedRow === customerId ? null : customerId);
  };
  
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Include branch parameter if admin has selected a branch
      let url = SummaryApi.getAllCustomers.url;
      if (user.role === 'admin' && user.selectedBranch) {
        url += `?branch=${user.selectedBranch}`;
      }
      
      const response = await fetch(url, {
        method: SummaryApi.getAllCustomers.method,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Sort by updatedAt or createdAt (newest first)
        const sortedData = data.data.sort((a, b) => {
          const aDate = a.updatedAt || a.createdAt;
          const bDate = b.updatedAt || b.createdAt;
          return new Date(bDate) - new Date(aDate);
        });
        
        setCustomers(sortedData);
        setFilteredCustomers(sortedData);
      } else {
        setError(data.message || 'Failed to fetch customers');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchCustomers();
  }, [user.selectedBranch]);
  
  // Handle opening the add customer modal with pre-populated phone
  const handleAddNew = (phoneNumber = '') => {
    setNewCustomerPhone(phoneNumber);
    setShowAddCustomerModal(true);
  };

  const handleViewCustomer = (customerId) => {
    setSelectedCustomerId(customerId);
    setShowCustomerDetailModal(true);
  };

  // Handle creating new project for a customer
  const handleCreateProject = (customerId) => {
    setSelectedCustomerId(customerId);
    setShowWorkOrderModal(true);
  };

  // Handle work order success
  const handleWorkOrderSuccess = (data) => {
    // Refresh contacts data to get updated customer info
    fetchCustomers();
    setShowWorkOrderModal(false);
  };

  // Handle customer added
  const handleCustomerAdded = (newCustomer) => {
    setShowAddCustomerModal(false);
    
    // Add the new customer to the top of the list
    setCustomers(prevCustomers => [newCustomer, ...prevCustomers]);
    
    // Update filtered customers if it matches current filters
    const matchesFilter = !filters.convertedOnly || newCustomer.convertedFromLead;
    if (matchesFilter) {
      setFilteredCustomers(prevFilteredCustomers => [newCustomer, ...prevFilteredCustomers]);
    }
  };
  
  // Customer update handler
  const handleCustomerUpdated = (updatedCustomer) => {
    // Update the customers list with the updated customer
    setCustomers(prevCustomers => {
      const customerIndex = prevCustomers.findIndex(
        customer => customer._id === updatedCustomer._id
      );
      
      if (customerIndex === -1) {
        return prevCustomers;
      }
      
      const newCustomers = [...prevCustomers];
      newCustomers[customerIndex] = updatedCustomer;
      
      return newCustomers;
    });
    
    // Also update filtered customers if needed
    setFilteredCustomers(prevFilteredCustomers => {
      const customerIndex = prevFilteredCustomers.findIndex(
        customer => customer._id === updatedCustomer._id
      );
      
      if (customerIndex === -1) {
        return prevFilteredCustomers;
      }
      
      const newFilteredCustomers = [...prevFilteredCustomers];
      newFilteredCustomers[customerIndex] = updatedCustomer;
      
      return newFilteredCustomers;
    });
  };
  
  // Handle search and filtering
  useEffect(() => {
    let results = [...customers];
    
    // Apply converted filter if selected
    if (filters.convertedOnly) {
      results = results.filter(customer => customer.convertedFromLead);
    }
    
    // Apply search query
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      results = results.filter(customer => 
        customer.name.toLowerCase().includes(query) ||
        customer.phoneNumber.includes(query) ||
        (customer.email && customer.email.toLowerCase().includes(query))
      );
    }
    
    setFilteredCustomers(results);
  }, [searchQuery, customers, filters]);
  
  // Function to check if search might be a valid phone number
  const isValidPhoneSearch = (query) => {
    return /^\d{10}$/.test(query) || /^\+\d{2}\d{8,12}$/.test(query);
  };
  
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Customer Management</h1>
          <p className="text-gray-600">Manage your customer database</p>
        </div>
        <button
          onClick={() => handleAddNew()}
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center"
        >
          <FiPlusCircle className="mr-2" />
          Add New Customer
        </button>
      </div>
      
      {/* Add Contact Modal */}
      <Modal 
        isOpen={showAddCustomerModal} 
        onClose={() => setShowAddCustomerModal(false)}
        title="Add New Lead/Customer"
        size="lg"
      >
        <AddContactForm 
          initialPhone={newCustomerPhone}
          initialType="customer" 
          onSuccess={handleCustomerAdded}
          onCancel={() => setShowAddCustomerModal(false)}
        />
      </Modal>

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        isOpen={showCustomerDetailModal}
        onClose={() => setShowCustomerDetailModal(false)}
        customerId={selectedCustomerId}
        onCustomerUpdated={handleCustomerUpdated}
      />

      {/* Work Order Modal for New Project */}
      <WorkOrderModal
        isOpen={showWorkOrderModal}
        onClose={() => setShowWorkOrderModal(false)}
        customerId={selectedCustomerId}
        onSuccess={handleWorkOrderSuccess}
      />
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder="Search by name, phone, or email..."
                className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
            
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="px-4 py-2 border rounded-md flex items-center hover:bg-gray-50"
            >
              <FiFilter className="mr-2" />
              Filter
            </button>
            
            <button
              onClick={fetchCustomers}
              className="px-4 py-2 border rounded-md flex items-center hover:bg-gray-50"
            >
              <FiRefreshCw className="mr-2" />
              Refresh
            </button>
          </div>
          
          {showFilter && (
            <div className="mt-4 p-4 border rounded-md bg-gray-50">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="convertedOnly"
                  checked={filters.convertedOnly}
                  onChange={() => setFilters({...filters, convertedOnly: !filters.convertedOnly})}
                  className="mr-2"
                />
                <label htmlFor="convertedOnly" className="text-sm font-medium text-gray-700">
                  Show only customers converted from leads
                </label>
              </div>
            </div>
          )}
        </div>
        
        {filteredCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Added</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th> */}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map(customer => (
                  <React.Fragment key={customer._id}>
                  <tr 
                    className={`border-l-4 ${customerColor} cursor-pointer hover:bg-gray-50`}
                    onClick={() => handleRowClick(customer._id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{customer.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{customer.phoneNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{customer.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(customer.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        customer.convertedFromLead 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {customer.convertedFromLead ? 'Converted Lead' : 'Direct Entry'}
                      </span>
                    </td>
                    {/* <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button 
                        onClick={() => handleViewCustomer(customer._id)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        View
                      </button>
                    </td> */}
                  </tr>
                {/* Expanded row with buttons */}
                {expandedRow === customer._id && (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 bg-gray-50">
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row toggle
                            handleViewCustomer(customer._id);
                          }}
                          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                        >
                          View Details
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row toggle
                            // New Complaint functionality
                            alert('New Complaint functionality will be implemented');
                          }}
                          className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                        >
                          New Complaint
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row toggle
                            // New Project functionality - now opens WorkOrderModal
                            handleCreateProject(customer._id);
                          }}
                          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                        >
                          New Project
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center">
          {searchQuery && (
            <div>
              <p className="text-gray-500 mb-4">
                No customers found matching "{searchQuery}"
              </p>
              {/* Show Add as New Customer button for valid phone numbers */}
              {isValidPhoneSearch(searchQuery) && (
                <button
                  onClick={() => handleAddNew(searchQuery)}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md inline-flex items-center"
                >
                  <FiUserPlus className="mr-2" />
                  Add as New Customer
                </button>
              )}
            </div>
          )}
          {!searchQuery && (
            <p className="text-gray-500">
              {customers.length > 0 
                ? 'Use the search bar to find customers.' 
                : 'No customers found. Add a new customer or convert leads to get started.'}
            </p>
          )}
        </div>
      )}
    </div>
  </div>
);
};

export default CustomerList;