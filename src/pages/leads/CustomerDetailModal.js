import React, { useState, useEffect } from 'react';
import { FiPhone, FiMail, FiMessageSquare, FiEdit2, FiClipboard, FiCalendar } from 'react-icons/fi';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import WorkOrderModal from '../customers/WorkOrderModal';
import ComplaintModal from '../customers/ComplaintModal';
import ProjectDetailsModal from '../manager/ProjectDetailsModal';

const CustomerDetailModal = ({ isOpen, onClose, customerId, onCustomerUpdated }) => {
  const { user } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [initialProjectCategory, setInitialProjectCategory] = useState('New Installation');
  const [showProjectDetailsModal, setShowProjectDetailsModal] = useState(false);
const [selectedProject, setSelectedProject] = useState(null);
const [expandedRow, setExpandedRow] = useState(null);
  
  const fetchCustomer = async () => {
    if (!customerId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${SummaryApi.getCustomer.url}/${customerId}`, {
        method: SummaryApi.getCustomer.method,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCustomer(data.data);
      } else {
        setError(data.message || 'Failed to fetch customer details');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error fetching customer:', err);
    } finally {
      setLoading(false);
    }
  };

  // Project details देखने के लिए handler function
const handleViewProjectDetails = async (project) => {
  try {
    setLoading(true);
    
    // Fetch full project details
    const response = await fetch(`${SummaryApi.getWorkOrderDetails.url}/${customer._id}/${project.orderId}`, {
      method: 'GET',
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      setSelectedProject(data.data);
      setShowProjectDetailsModal(true);
    } else {
      console.error('API returned error:', data.message);
      // If API fails, use the basic project data we have
      setSelectedProject(project);
      setShowProjectDetailsModal(true);
    }
  } catch (err) {
    console.error('Error fetching project details:', err);
    // Fall back to basic project data
    setSelectedProject(project);
    setShowProjectDetailsModal(true);
  } finally {
    setLoading(false);
  }
};
  
  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomer();
    } else {
      // Reset state when modal closes
      setCustomer(null);
      setError(null);
    }
  }, [isOpen, customerId]);
  
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

  const handleWorkOrderSuccess = (data) => {
    // Refresh customer data after adding new project/work order
    fetchCustomer();
    setShowWorkOrderModal(false);
    
    // Notify parent component of the update
    if (onCustomerUpdated) {
      onCustomerUpdated(data.customer);
    }
  };

  const handleComplaintSuccess = (data) => {
    // Refresh customer data after adding new complaint
    fetchCustomer();
    setShowComplaintModal(false);
    
    // Notify parent component of the update
    if (onCustomerUpdated) {
      onCustomerUpdated(data.customer);
    }
  };
  
  const handleNewComplaint = () => {
    // Check if customer has any projects
    if (customer?.projects?.length > 0) {
      setShowComplaintModal(true);
    } else {
      alert('Customer must have at least one project before filing a complaint');
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Customer Details"
      size="xl"
    >
      {loading ? (
        <div className="p-6 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        </div>
      ) : customer ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-2">
          {/* Customer info panel */}
          <div className="lg:col-span-1 bg-white rounded-lg border overflow-hidden border-t-4 border-purple-500">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{customer.name}</h2>
                  <div className="text-sm text-gray-500 mt-1">
                    Added on {formatDate(customer.createdAt)}
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
                  Customer
                </span>
              </div>
              
              {/* Contact info */}
              <div className="space-y-4 mt-6">
                <div className="flex items-start">
                  <FiPhone className="mt-1 mr-3 text-gray-500" />
                  <div>
                    <div className="text-sm text-gray-500">Phone Number</div>
                    <div>{customer.phoneNumber}</div>
                  </div>
                </div>
                
                {customer.whatsappNumber && (
                  <div className="flex items-start">
                    <FiMessageSquare className="mt-1 mr-3 text-gray-500" />
                    <div>
                      <div className="text-sm text-gray-500">WhatsApp</div>
                      <div>{customer.whatsappNumber}</div>
                    </div>
                  </div>
                )}
                
                {customer.email && (
                  <div className="flex items-start">
                    <FiMail className="mt-1 mr-3 text-gray-500" />
                    <div>
                      <div className="text-sm text-gray-500">Email</div>
                      <div>{customer.email}</div>
                    </div>
                  </div>
                )}
                
                {customer.address && (
                  <div className="flex items-start">
                    <div className="mt-1 mr-3 text-gray-500">📍</div>
                    <div>
                      <div className="text-sm text-gray-500">Address</div>
                      <div>{customer.address}</div>
                    </div>
                  </div>
                )}
                
                {customer.age && (
                  <div className="flex items-start">
                    <FiCalendar className="mt-1 mr-3 text-gray-500" />
                    <div>
                      <div className="text-sm text-gray-500">Age</div>
                      <div>{customer.age} years</div>
                    </div>
                  </div>
                )}
                
                {customer.branch && (
                  <div className="flex items-start">
                    <div className="mt-1 mr-3 text-gray-500">🏢</div>
                    <div>
                      <div className="text-sm text-gray-500">Branch</div>
                      <div>{customer.branch.name}</div>
                    </div>
                  </div>
                )}
                
                {customer.convertedFromLead && (
                  <div className="flex items-start">
                    <FiClipboard className="mt-1 mr-3 text-gray-500" />
                    <div>
                      <div className="text-sm text-gray-500">Origin</div>
                      <div>Converted from Lead</div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-8 space-y-3">
              {user.role !== 'admin' && (
                <button
                  onClick={() => {
                    // Edit logic to be implemented
                    alert('Edit functionality will be implemented in the future');
                  }}
                  className="w-full py-2 px-4 border border-gray-300 rounded-md flex items-center justify-center text-gray-700 hover:bg-gray-50"
                >
                  <FiEdit2 className="mr-2" />
                  Edit Customer
                </button>
              )}
              </div>
            </div>
          </div>
          
          {/* Projects and Activity panel */}
          <div className="lg:col-span-2 bg-white rounded-lg overflow-hidden border border-gray-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Work Orders & Complaints</h2>
                
                {user.role !== 'admin' && (
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                    onClick={handleNewComplaint}
                  >
                    New Complaint
                  </button>
                  
                  <button
                    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                    onClick={() => setShowWorkOrderModal(true)}
                  >
                    New Project
                  </button>
                </div>
                )}
              </div>
              
              {/* Work Order/Complaint Status */}
              {customer.workOrders && customer.workOrders.length > 0 ? (
  <div className="mb-6 max-h-[400px] overflow-y-auto">
    <div className="overflow-visible">
      <table className="min-w-full divide-y divide-gray-200 table-fixed">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sr.No
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Project Type
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Category
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
        {[...customer.workOrders]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((order, index) => (
              <React.Fragment key={index}>
            <tr 
            onClick={() => setExpandedRow(expandedRow === order._id ? null : order._id)}
            className={`hover:bg-gray-50 cursor-pointer ${
              expandedRow === order._id ? 'bg-gray-50' : ''
            }`}
            >
              <td className="px-2 py-3 whitespace-nowrap">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                <div style={{ width: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {order.projectType}
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            order.projectCategory === 'Repair' 
                              ? 'bg-orange-100 text-orange-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {order.projectCategory === 'Repair' ? 'Complaint' : 'New Installation'}
                          </span>
                        </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
              <div style={{ width: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {formatDate(order.createdAt)}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  order.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                  order.status === 'completed' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {order.status}
                </span>
              </td>
            </tr>
            {/* Expanded row with buttons */}
            {expandedRow === order._id && (
                <tr>
                  <td colSpan="5" className="px-6 py-4 bg-gray-50 border-b">
                    <div className="flex space-x-3">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewProjectDetails(order);
                        }}
                        className="inline-flex items-center px-4 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-500 hover:bg-blue-600"
                      >
                        View Details
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
  </div>
): (
  <div className="mb-6 p-6 text-center border rounded-md bg-gray-50">
    <p className="text-gray-500">No Project and Complaints found for this customer.</p>
  </div>
)}
              
              {/* Lead History */}
              {customer.convertedFromLead && customer.leadId && (
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-2">Lead History</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    {customer.leadId.remarks && customer.leadId.remarks.length > 0 ? (
                      <div className="space-y-3">
                        {customer.leadId.remarks.map((remark, index) => (
                          <div 
                            key={index} 
                            className="p-3 border-l-4 rounded-md bg-white"
                            style={{
                              borderColor: 
                                remark.status === 'positive' ? '#10B981' : 
                                remark.status === 'negative' ? '#EF4444' : 
                                '#9CA3AF'
                            }}
                          >
                            <div className="flex justify-between mb-1">
                              <span className="font-medium text-sm capitalize">{remark.status}</span>
                              <span className="text-sm text-gray-500">{formatDate(remark.createdAt)}</span>
                            </div>
                            <p className="text-gray-700">{remark.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No lead history available
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-gray-500">
          Customer not found
        </div>
      )}
      
      {/* Work Order Modal */}
      <WorkOrderModal
        isOpen={showWorkOrderModal}
        onClose={() => setShowWorkOrderModal(false)}
        customerId={customerId}
        initialProjectCategory="New Installation"
        onSuccess={handleWorkOrderSuccess}
      />
      
      {/* Complaint Modal - new component */}
      <ComplaintModal
        isOpen={showComplaintModal}
        onClose={() => setShowComplaintModal(false)}
        customerId={customerId}
        onSuccess={handleComplaintSuccess}
      />

      {showProjectDetailsModal && selectedProject && (
        <ProjectDetailsModal 
          isOpen={showProjectDetailsModal}
          onClose={() => {
            setShowProjectDetailsModal(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
          onProjectApproved={(updatedProject) => {
            // If project is approved, refresh customer data
            fetchCustomer();
            setShowProjectDetailsModal(false);
          }}
        />
      )}
    </Modal>
  );
};

export default CustomerDetailModal;