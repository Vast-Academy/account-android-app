import React, { useState, useEffect } from 'react';
import { FiSearch, FiPlusCircle, FiFilter, FiRefreshCw, FiUserPlus } from 'react-icons/fi';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import AddContactForm from './AddContactForm';
import LeadDetailModal from '../leads/LeadDetail';
import CustomerDetailModal from './CustomerDetailModal';
import WorkOrderModal from '../customers/WorkOrderModal';
import ComplaintModal from '../customers/ComplaintModal';

const statusColors = {
  positive: 'bg-green-100 text-green-800',
  negative: 'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-800',
};

const ContactsPage = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [filters, setFilters] = useState({
    type: 'all', // 'all', 'lead', 'customer'
    status: 'all'
  });
  
  // State for modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLeadDetailModal, setShowLeadDetailModal] = useState(false);
  const [showCustomerDetailModal, setShowCustomerDetailModal] = useState(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [initialPhone, setInitialPhone] = useState('');
  const [initialType, setInitialType] = useState('lead');
  const [expandedRow, setExpandedRow] = useState(null);
  const [openInConvertMode, setOpenInConvertMode] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(0);

  // Add a handler function for complaint success
const handleComplaintSuccess = (data) => {
  // Refresh contacts data to get updated customer info
  fetchContacts();
  setShowComplaintModal(false);
};

  const handleRowClick = (contactId) => {
    // अगर पहले से ही expanded है तो collapse करें, अन्यथा expand करें
    setExpandedRow(expandedRow === contactId ? null : contactId);
  };
  
  // Fetch contacts function
const fetchContacts = async (forceFresh = false) => {
  try {
    // कैश्ड डेटा चेक करें
    const cachedContacts = localStorage.getItem('contactsData');
    
    // कैश उपलब्ध है और फ्रेश डेटा फोर्स नहीं किया गया है तो कैश उपयोग करें
    // (timestamp check हटा दें)
    if (!forceFresh && cachedContacts) {
      const parsedContacts = JSON.parse(cachedContacts);
      setContacts(parsedContacts);
      applyFilters(parsedContacts);
      // console.log("Using cached contacts data");
      
      // बैकग्राउंड में फ्रेश डेटा फेच करें
      fetchFreshContactsInBackground();
      setLoading(false);
      return;
    }
    
    // अगर कैश नहीं है या फ्रेश डेटा फोर्स किया गया है तो फ्रेश डेटा फेच करें
    setLoading(true);
    await fetchFreshContacts();
  } catch (err) {
    // एरर होने पर कैश डेटा का उपयोग करें
    const cachedContacts = localStorage.getItem('contactsData');
    
    if (cachedContacts) {
      const parsedContacts = JSON.parse(cachedContacts);
      setContacts(parsedContacts);
      applyFilters(parsedContacts);
      console.log("Using cached contacts data after fetch error");
    } else {
      setError('Server error. Please try again later.');
      console.error('Error fetching contacts:', err);
    }
  } finally {
    setLoading(false);
  }
};
  
  // बैकग्राउंड फेचिंग फंक्शन
  const fetchFreshContactsInBackground = async () => {
    try {
      await fetchFreshContacts(true);
    } catch (err) {
      console.error('Error fetching contacts in background:', err);
    }
  };
  
  // ताजा डेटा फेच करने का फंक्शन
  const fetchFreshContacts = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
      setError(null);
    }
    
    try {
      // Include branch parameter if admin has selected a branch
      let branchParam = '';
      if (user.role === 'admin' && user.selectedBranch) {
        branchParam = `?branch=${user.selectedBranch}`;
      }
      
      // Fetch leads
      const leadsResponse = await fetch(`${SummaryApi.getAllLeads.url}${branchParam}`, {
        method: SummaryApi.getAllLeads.method,
        credentials: 'include'
      });
      
      const leadsData = await leadsResponse.json();
      
      // Fetch customers
      const customersResponse = await fetch(`${SummaryApi.getAllCustomers.url}${branchParam}`, {
        method: SummaryApi.getAllCustomers.method,
        credentials: 'include'
      });
      
      const customersData = await customersResponse.json();
      
      // Process leads data
      const processedLeads = leadsData.success ? leadsData.data.map(lead => ({
        ...lead,
        contactType: 'lead'
      })) : [];
      
      // Process customers data
      const processedCustomers = customersData.success ? customersData.data.map(customer => ({
        ...customer,
        contactType: 'customer',
        status: 'positive' // Customers are always marked as positive
      })) : [];
      
      // Combine data and sort by createdAt date (newest first)
      const combinedContacts = [...processedLeads, ...processedCustomers];
      combinedContacts.sort((a, b) => {
        const aDate = a.updatedAt || a.createdAt;
        const bDate = b.updatedAt || b.createdAt;
        return new Date(bDate) - new Date(aDate);
      });
  
      setContacts(combinedContacts);
      applyFilters(combinedContacts);
      
      // कॉन्टैक्ट्स डेटा कैश करें
      localStorage.setItem('contactsData', JSON.stringify(combinedContacts));
      
      // रिफ्रेश टाइम अपडेट करें
      setLastRefreshTime(new Date().getTime());
    } catch (err) {
      if (!isBackground) {
        setError('Server error. Please try again later.');
        console.error('Error fetching contacts:', err);
      }
      throw err;
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };
  
  useEffect(() => {
    fetchContacts();
  }, [user.selectedBranch]);
  
// फ़िल्टर टैब्स का हैंडलर
const handleFilterChange = (type, status = 'all') => {
  // पहले फ़िल्टर्स सेट करें
  setFilters({ type, status });
  
  // फिर मूल डेटा पर फ़िल्टरिंग करें
  let filtered = [...contacts];
  
  // Filter by type
  if (type !== 'all') {
    filtered = filtered.filter(contact => contact.contactType === type);
  }
  
  // Filter by status
  if (status !== 'all') {
    filtered = filtered.filter(contact => contact.status === status);
  }
  
  // Apply search query
  if (searchQuery.trim() !== '') {
    filtered = filtered.filter(contact => 
      (contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phoneNumber.includes(searchQuery) ||
      (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase())))
    );
  }
  
  setFilteredContacts(filtered);
};

  // Handle opening lead detail modal
  const handleViewLead = (leadId, convertMode = false) => {
    setSelectedLeadId(leadId);
    setOpenInConvertMode(convertMode);
    setShowLeadDetailModal(true);
  };
  
  // Handle opening customer detail modal
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
    fetchContacts();
    setShowWorkOrderModal(false);
  };
  
  // Handle view of a contact (either lead or customer)
  const handleViewContact = (contact) => {
    if (contact.contactType === 'lead') {
      handleViewLead(contact._id);
    } else {
      handleViewCustomer(contact._id);
    }
  };
  
  // Handle lead conversion success
  const handleLeadConverted = (leadId, newCustomer) => {
    // लीड को लिस्ट से हटाएं
    setContacts(prevContacts => {
      const updatedContacts = prevContacts.filter(
        contact => !(contact.contactType === 'lead' && contact._id === leadId)
      );
      
      // अगर नया कस्टमर डेटा है तो उसे लिस्ट के शुरू में जोड़ें
      if (newCustomer) {
        return [
          { ...newCustomer, contactType: 'customer' },
          ...updatedContacts
        ];
      }
      
      return updatedContacts;
    });
    
    // मॉडल बंद करें
    setShowLeadDetailModal(false);
  };

  // Customer update handler
  const handleCustomerUpdated = (updatedCustomer) => {
    setContacts(prevContacts => {
      const contactIndex = prevContacts.findIndex(
        contact => contact.contactType === 'customer' && contact._id === updatedCustomer._id
      );
      
      if (contactIndex === -1) {
        return prevContacts;
      }
      
      const newContacts = [...prevContacts];
      
      const updatedContact = {
        ...updatedCustomer,
        contactType: 'customer'
      };
      
      newContacts.splice(contactIndex, 1);
      
      return [updatedContact, ...newContacts];
    });
  };

  // ModalForm के onSuccess हैंडलर
  const handleContactAdded = (newContact) => {
    setShowAddModal(false);
    
    // एक additional contactType प्रॉपर्टी जोड़ें
    const contactTypeField = newContact.projectType ? 'customer' : 'lead';
    const contactWithType = {
      ...newContact,
      contactType: contactTypeField
    };
    
    // स्टेट अपडेट करें
  const updatedContacts = [contactWithType, ...contacts];
  setContacts(updatedContacts);
  
  // फिल्टर्स को फिर से लागू करें
  applyFilters(updatedContacts);
  
  // कैश अपडेट करें
  localStorage.setItem('contactsData', JSON.stringify(updatedContacts));
}

  // LeadDetailModal से लीड अपडेट हैंडलिंग
  const handleLeadUpdated = (updatedLead) => {
    // अपडेटेड लीड को फ़ाइंड और रिप्लेस करें
    setContacts(prevContacts => {
      const contactIndex = prevContacts.findIndex(
        contact => contact.contactType === 'lead' && contact._id === updatedLead._id
      );
      
      if (contactIndex === -1) {
        return prevContacts;
      }
      
      // नई कॉपी बनाएं
      const newContacts = [...prevContacts];
      
      // अपडेटेड लीड को contactType के साथ सेट करें
      const updatedContact = {
        ...updatedLead,
        contactType: 'lead'
      };
      
      // पहले लीड को हटाएं
      newContacts.splice(contactIndex, 1);
      
      // फिर सबसे पहले पोजीशन पर जोड़ें
      return [updatedContact, ...newContacts];
    });
  };
    
  // Handle adding a new contact
  const handleAddNew = (phoneNumber = '', type = 'lead') => {
    setInitialPhone(phoneNumber);
    setInitialType(type);
    setShowAddModal(true);
  };
  
  // Apply filters to the contacts
  const applyFilters = (contactsToFilter) => {
    let filtered = contactsToFilter;
    
    // Filter by type
    if (filters.type !== 'all') {
      filtered = filtered.filter(contact => contact.contactType === filters.type);
    }
    
    // Filter by status
    if (filters.status !== 'all') {
      filtered = filtered.filter(contact => contact.status === filters.status);
    }
    
    // Apply search query
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(contact => 
        (contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phoneNumber.includes(searchQuery) ||
        (contact.email && contact.email.toLowerCase().includes(searchQuery.toLowerCase())))
      );
    }
    
    setFilteredContacts(filtered);
  };
  
  // Handle search and filters
  useEffect(() => {
    applyFilters(contacts);
  }, [searchQuery, filters, contacts]);
  
  // Function to check if search might be a valid phone number
  const isValidPhoneSearch = (query) => {
    return /^\d{10}$/.test(query) || /^\+\d{2}\d{8,12}$/.test(query);
  };

  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="">
      {/* Main Container with White Box */}
      <div className="px-6 bg-white rounded-lg shadow-md max-w-[1300px]">
        {/* Header */}
        <div className="py-6 pb-4 flex justify-between items-center">
  <h1 className="text-2xl font-semibold text-gray-800">Lead & Customer Management</h1>
  
  <button 
    onClick={() => fetchFreshContacts()}
    className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700"
    title="Refresh Contacts"
  >
    <FiRefreshCw className="w-5 h-5" />
  </button>
</div>
        
        {/* Control Bar - Single row with Add button, filter buttons and search */}
        <div className="pb-4">
          
          <div className="flex items-center justify-between gap-4">
          {user.role !== 'admin' && (
          <button
            onClick={() => handleAddNew()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full flex items-center whitespace-nowrap"
          >
            <FiPlusCircle className="mr-2" size={18} />
            Add New Lead/Customer
          </button>
          )}
          
           {/* Filter Buttons */}
           <div className="flex space-x-2">
            <button
             onClick={() => handleFilterChange('all')}
              className={`px-4 py-1.5 rounded-full text-sm ${
                filters.type === 'all' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              All
            </button>
            <button
               onClick={() => handleFilterChange('lead')}
              className={`px-4 py-1.5 rounded-full text-sm ${
                filters.type === 'lead' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Leads
            </button>
            <button
              onClick={() => handleFilterChange('customer')}
              className={`px-4 py-1.5 rounded-full text-sm ${
                filters.type === 'customer' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Customers
            </button>
            
            {/* Status Filters - only shown when Leads is selected */}
            {filters.type === 'lead' && (
              <>
                <button
                 onClick={() => handleFilterChange('lead', 'positive')}
                  className={`px-4 py-1.5 rounded-full text-sm ${
                    filters.status === 'positive' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  Positive
                </button>
                <button
                  onClick={() => handleFilterChange('lead', 'neutral')}
                  className={`px-4 py-1.5 rounded-full text-sm ${
                    filters.status === 'neutral' 
                      ? 'bg-gray-500 text-white' 
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  Neutral
                </button>
                <button
                 onClick={() => handleFilterChange('lead', 'negative')}
                  className={`px-4 py-1.5 rounded-full text-sm ${
                    filters.status === 'negative' 
                      ? 'bg-red-500 text-white' 
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  Negative
                </button>
              </>
            )}
          </div>
          </div>

{/* Search Bar - push to the right */}
<div className="relative flex-grow mt-4">
            <input
              type="text"
              placeholder="Search customers..."
              className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>

        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {/* Contacts Table */}
        <div className="border-t">
          {filteredContacts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">S.NO</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NAME</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PHONE</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TYPE</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DATE ADDED</th>
                    {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STATUS</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LAST REMARK/PROJECT</th> */}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredContacts.map((contact, index) => (
                    <React.Fragment key={`${contact.contactType}-${contact._id}`}>
                      <tr 
                        className={`hover:bg-gray-50 cursor-pointer ${
                          expandedRow === `${contact.contactType}-${contact._id}` ? 'bg-gray-50' : ''
                        }`}
                        onClick={() => handleRowClick(`${contact.contactType}-${contact._id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {contact.name}
                          {contact.email && <div className="text-xs text-gray-500">{contact.email}</div>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{contact.phoneNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            contact.contactType === 'lead' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {contact.contactType === 'lead' ? 'Lead' : 'Customer'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(contact.createdAt)}
                        </td>
                        {/* <td className="px-6 py-4 whitespace-nowrap">
                          {contact.contactType === 'lead' && (
                            <span className={`px-2 py-1 rounded-full text-xs capitalize ${
                              contact.status === 'positive' ? 'bg-green-100 text-green-800' :
                              contact.status === 'negative' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {contact.status}
                            </span>
                          )}
                          {contact.contactType === 'customer' && (
                            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                              Customer
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {contact.contactType === 'lead' && contact.remarks && contact.remarks.length > 0 ? (
                            <div className="max-w-xs truncate">
                              {contact.remarks[contact.remarks.length - 1].text}
                            </div>
                          ) : contact.contactType === 'customer' ? (
                            <div className="max-w-xs truncate">
                              {contact.projects && contact.projects.length > 0 
                                ? contact.projects[0].projectType 
                                : contact.projectType || 'No information'}
                            </div>
                          ) : (
                            <span className="text-gray-400">No information</span>
                          )}
                        </td> */}
                      </tr>
                      
                      {/* Expanded row - only show when expanded */}
                      {expandedRow === `${contact.contactType}-${contact._id}` && (
                        <tr>
                          <td colSpan="7" className="px-6 py-4 bg-gray-50 border-b">
                            <div className="flex space-x-3">
                              {contact.contactType === 'lead' ? (
                                <>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewLead(contact._id);
                                    }}
                                    className="inline-flex items-center px-4 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600"
                                  >
                                    View Details
                                  </button>
                                  {/* Only show Convert to Customer button if not admin */}
                                  {user.role !== 'admin' && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewLead(contact._id, true);
                                    }}
                                    className="inline-flex items-center px-4 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-500 hover:bg-green-600"
                                  >
                                    Convert to Customer
                                  </button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewCustomer(contact._id);
                                    }}
                                    className="inline-flex items-center px-4 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600"
                                  >
                                    View Details
                                  </button>
                                  {/* Only show these buttons if not admin */}
                                  {user.role !== 'admin' && (
                                    <>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCustomerId(contact._id);
                                      setShowComplaintModal(true);
                                    }}
                                    className="inline-flex items-center px-4 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600"
                                  >
                                    New Complaint
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCreateProject(contact._id);
                                    }}
                                    className="inline-flex items-center px-4 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-500 hover:bg-green-600"
                                  >
                                    New Project
                                  </button>
                                  </>
                                  )}
                                </>
                              )}
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
                    No contacts found matching "{searchQuery}"
                  </p>
                  {isValidPhoneSearch(searchQuery) && (
                    <div className="flex justify-center space-x-4">
                      <button
                        onClick={() => handleAddNew(searchQuery, 'lead')}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-md inline-flex items-center text-sm"
                      >
                        <FiUserPlus className="mr-2" />
                        Add as New Lead
                      </button>
                      <button
                        onClick={() => handleAddNew(searchQuery, 'customer')}
                        className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-1.5 rounded-md inline-flex items-center text-sm"
                      >
                        <FiUserPlus className="mr-2" />
                        Add as New Customer
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!searchQuery && (
                <p className="text-gray-500">
                  Use the search bar to find contacts.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* All modals remain the same */}
      <Modal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)}
        title="Add New Lead/Customer"
        size="lg"
      >
        <AddContactForm 
          initialPhone={initialPhone}
          initialType={initialType}
          onSuccess={handleContactAdded}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>
      
      <LeadDetailModal
        isOpen={showLeadDetailModal}
        onClose={() => {
          setShowLeadDetailModal(false);
          setOpenInConvertMode(false);
        }}
        leadId={selectedLeadId}
        onLeadUpdated={handleLeadUpdated}
        onConvertSuccess={handleLeadConverted}
        initialConvertMode={openInConvertMode}
      />
      
      <CustomerDetailModal
        isOpen={showCustomerDetailModal}
        onClose={() => setShowCustomerDetailModal(false)}
        customerId={selectedCustomerId}
        onCustomerUpdated={handleCustomerUpdated}
      />

      <WorkOrderModal
        isOpen={showWorkOrderModal}
        onClose={() => setShowWorkOrderModal(false)}
        customerId={selectedCustomerId}
        onSuccess={handleWorkOrderSuccess}
      />

<ComplaintModal
  isOpen={showComplaintModal}
  onClose={() => setShowComplaintModal(false)}
  customerId={selectedCustomerId}
  onSuccess={handleComplaintSuccess}
/>
    </div>
  );
};

export default ContactsPage;