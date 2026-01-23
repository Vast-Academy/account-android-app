import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiSearch, FiPlusCircle, FiFilter, FiRefreshCw, FiUserPlus } from 'react-icons/fi';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import LeadDetailModal from './LeadDetail';
import EditLeadForm from './EditLeadForm';
import AddContactForm from './AddContactForm';

const statusColors = {
  positive: 'bg-green-100 border-green-500 text-green-800',
  negative: 'bg-red-100 border-red-500 text-red-800',
  neutral: 'bg-gray-100 border-gray-400 text-gray-800'
};

const LeadList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all'
  });
  
  // State for modals
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  const handleRowClick = (leadId) => {
    // अगर वही रो क्लिक की गई है जो पहले से एक्सपैंडेड है, तो उसे कोलैप्स करें, अन्यथा एक्सपैंड करें
    setExpandedRow(expandedRow === leadId ? null : leadId);
  };
  
  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Include branch parameter if admin has selected a branch
      let url = SummaryApi.getAllLeads.url;
      if (user.role === 'admin' && user.selectedBranch) {
        url += `?branch=${user.selectedBranch}`;
      }
      
      const response = await fetch(url, {
        method: SummaryApi.getAllLeads.method,
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
        
        setLeads(sortedData);
        setFilteredLeads(sortedData);
      } else {
        setError(data.message || 'Failed to fetch leads');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchLeads();
  }, [user.selectedBranch]);
  
  // Handle opening lead detail modal from direct URL/route
  useEffect(() => {
    if (location.state?.openLeadDetail && location.state?.leadId) {
      setSelectedLeadId(location.state.leadId);
      setShowDetailModal(true);
      
      // Clear the state to prevent reopening on navigation
      navigate('/leads', { replace: true });
    }
  }, [location.state, navigate]);

  // Handle opening the add lead modal with pre-populated phone
  const handleAddNew = (phoneNumber = '') => {
    setNewLeadPhone(phoneNumber);
    setShowAddLeadModal(true);
  };
  
  // Handle viewing lead details in modal
  const handleViewLead = (leadId) => {
    setSelectedLeadId(leadId);
    setShowDetailModal(true);
  };
  
  // Handle editing a lead
  const handleEditLead = (leadId) => {
    setSelectedLeadId(leadId);
    setShowDetailModal(false);
    setShowEditModal(true);
  };
  
  // Handle lead detail modal close with action
  const handleDetailModalClose = (action, leadId) => {
    setShowDetailModal(false);
    
    if (action === 'edit' && leadId) {
      handleEditLead(leadId);
    }
  };
  
  // Handle successful lead conversion
  const handleLeadConverted = (leadId) => {
    // Remove lead from the list
    setLeads(prevLeads => prevLeads.filter(lead => lead._id !== leadId));
    setFilteredLeads(prevFilteredLeads => prevFilteredLeads.filter(lead => lead._id !== leadId));
    
    // Close any open modals
    setShowDetailModal(false);
    setShowEditModal(false);
  };
  
  // Handle lead update
  const handleLeadUpdated = (updatedLead) => {
    // Update the lead in the lists by removing it and adding it to the top
    setLeads(prevLeads => {
      const otherLeads = prevLeads.filter(lead => lead._id !== updatedLead._id);
      return [updatedLead, ...otherLeads];
    });
    
    // Update filtered leads similarly
    setFilteredLeads(prevFilteredLeads => {
      // Only update if the current filters would include this lead
      if (filters.status === 'all' || updatedLead.status === filters.status) {
        const otherLeads = prevFilteredLeads.filter(lead => lead._id !== updatedLead._id);
        return [updatedLead, ...otherLeads];
      } else {
        return prevFilteredLeads.filter(lead => lead._id !== updatedLead._id);
      }
    });
  };
  
  // Handle lead added
  const handleLeadAdded = (newLead) => {
    setShowAddLeadModal(false);
    
    // Add new lead to the top of the list
    setLeads(prevLeads => [newLead, ...prevLeads]);
    
    // Update filtered leads if it matches current filters
    if (filters.status === 'all' || newLead.status === filters.status) {
      setFilteredLeads(prevFilteredLeads => [newLead, ...prevFilteredLeads]);
    }
  };
  
  // Handle search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      // Apply only filters when no search query
      applyFilters(leads);
    } else {
      // Apply search and filters
      const results = leads.filter(lead => 
        (lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phoneNumber.includes(searchQuery) ||
        (lead.email && lead.email.toLowerCase().includes(searchQuery.toLowerCase()))) &&
        (filters.status === 'all' || lead.status === filters.status)
      );
      setFilteredLeads(results);
    }
  }, [searchQuery, leads, filters]);
  
  const applyFilters = (leadsToFilter) => {
    if (filters.status === 'all') {
      setFilteredLeads(leadsToFilter);
    } else {
      const filtered = leadsToFilter.filter(lead => lead.status === filters.status);
      setFilteredLeads(filtered);
    }
  };
  
  // Function to check if search might be a valid phone number (10 digits for India)
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
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Lead Management</h1>
          <p className="text-gray-600">Manage and track all your leads</p>
        </div>
        <button
          onClick={() => handleAddNew()}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center"
        >
          <FiPlusCircle className="mr-2" />
          Add New Lead
        </button>
      </div>
      
      {/* Add Contact Modal */}
      <Modal 
        isOpen={showAddLeadModal} 
        onClose={() => setShowAddLeadModal(false)}
        title="Add New Lead/Customer"
        size="lg"
      >
        <AddContactForm 
          initialPhone={newLeadPhone} 
          initialType="lead"
          onSuccess={handleLeadAdded}
          onCancel={() => setShowAddLeadModal(false)}
        />
      </Modal>
      
      {/* Lead Detail Modal */}
      <LeadDetailModal
        isOpen={showDetailModal}
        onClose={(action, leadId) => handleDetailModalClose(action, leadId)}
        leadId={selectedLeadId}
        onLeadUpdated={handleLeadUpdated}
        onConvertSuccess={handleLeadConverted}
      />
      
      {/* Edit Lead Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Lead"
        size="lg"
      >
        <EditLeadForm
          leadId={selectedLeadId}
          onSuccess={(updatedLead) => {
            setShowEditModal(false);
            handleLeadUpdated(updatedLead);
            // If detail modal was open before, reopen it with updated data
            setShowDetailModal(true);
          }}
          onCancel={() => {
            setShowEditModal(false);
            // If detail modal was open before, reopen it
            setShowDetailModal(true);
          }}
        />
      </Modal>
      
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
              onClick={fetchLeads}
              className="px-4 py-2 border rounded-md flex items-center hover:bg-gray-50"
            >
              <FiRefreshCw className="mr-2" />
              Refresh
            </button>
          </div>
          
          {showFilter && (
            <div className="mt-4 p-4 border rounded-md bg-gray-50">
              <div className="mb-2 font-medium">Filter by Status:</div>
              <div className="flex gap-3">
                <button
                  onClick={() => setFilters({...filters, status: 'all'})}
                  className={`px-3 py-1 rounded-full text-sm ${
                    filters.status === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilters({...filters, status: 'positive'})}
                  className={`px-3 py-1 rounded-full text-sm ${
                    filters.status === 'positive' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-800'
                  }`}
                >
                  Positive
                </button>
                <button
                  onClick={() => setFilters({...filters, status: 'neutral'})}
                  className={`px-3 py-1 rounded-full text-sm ${
                    filters.status === 'neutral' ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  Neutral
                </button>
                <button
                  onClick={() => setFilters({...filters, status: 'negative'})}
                  className={`px-3 py-1 rounded-full text-sm ${
                    filters.status === 'negative' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-800'
                  }`}
                >
                  Negative
                </button>
              </div>
            </div>
          )}
        </div>
        
        {filteredLeads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Added</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Remark</th>
                  {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th> */}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeads.map(lead => (
                   <React.Fragment key={lead._id}>
                 <tr 
        className={`border-l-4 ${statusColors[lead.status]} cursor-pointer hover:bg-gray-50`}
        onClick={() => handleRowClick(lead._id)}
      >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{lead.name}</div>
                      {lead.email && <div className="text-sm text-gray-500">{lead.email}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{lead.phoneNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs capitalize ${
                        lead.status === 'positive' ? 'bg-green-100 text-green-800' :
                        lead.status === 'negative' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.remarks && lead.remarks.length > 0 ? (
                        <div className="max-w-xs truncate">
                          {lead.remarks[lead.remarks.length - 1].text}
                        </div>
                      ) : (
                        <span className="text-gray-400">No remarks yet</span>
                      )}
                    </td>
                    {/* <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button 
                        onClick={() => handleViewLead(lead._id)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        View
                      </button>
                    </td> */}
                  </tr>
                {/* Expanded row with buttons */}
      {expandedRow === lead._id && (
        <tr>
          <td colSpan="5" className="px-6 py-4 bg-gray-50">
            <div className="flex gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation(); // Prevent row toggle
                  handleViewLead(lead._id);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                View Details
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation(); // Prevent row toggle
                  // First view the lead detail with convert dialog open
                  setSelectedLeadId(lead._id);
                  setShowDetailModal(true);
                }}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Convert to Customer
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
                  {filteredLeads.length === 0 
                    ? `No leads found matching "${searchQuery}"` 
                    : `Found ${filteredLeads.length} leads matching "${searchQuery}"`
                  }
                </p>
                {/* Only show the Add as New Lead button when we have a valid phone format */}
                {(filteredLeads.length === 0 && isValidPhoneSearch(searchQuery)) && (
                  <button
                    onClick={() => handleAddNew(searchQuery)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md inline-flex items-center"
                  >
                    <FiUserPlus className="mr-2" />
                    Add as New Lead
                  </button>
                )}
              </div>
            )}
            {!searchQuery && (
              <p className="text-gray-500">
                {leads.length > 0 ? 'Use the search bar to find leads.' : 'No leads found. Add a new lead to get started.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadList;