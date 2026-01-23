import React, { useState, useEffect } from 'react';
import { FiEdit2, FiEye } from 'react-icons/fi';
import SummaryApi from '../../common';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import ProjectDetailsModal from '../manager/ProjectDetailsModal';
import EditTechnicianModal from '../users/EditTechnicianModal';

const TechnicianDetailModal = ({ isOpen, onClose, technicianId, onTechnicianUpdated }) => {
  const { user } = useAuth();
  const [technician, setTechnician] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectsData, setProjectsData] = useState({
    inProgressProjects: [],
    pendingApprovalProjects: [],
    transferredProjects: [],
    completedProjects: []
  });
  
  // Project details modal state
  const [showProjectDetailsModal, setShowProjectDetailsModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const fetchTechnician = async () => {
    if (!technicianId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${SummaryApi.getUser.url}/${technicianId}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTechnician(data.data);
        // Fetch the technician's projects
        fetchTechnicianProjects(technicianId);
      } else {
        setError(data.message || 'Failed to fetch technician details');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error fetching technician:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchTechnicianProjects = async (id) => {
    try {
      const response = await fetch(`${SummaryApi.getTechnicianProjects.url}/${id}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Separate projects by status
        const inProgress = data.data.filter(project => 
          ['assigned', 'in-progress', 'paused'].includes(project.status)
        );
        const pendingApproval = data.data.filter(project => 
          project.status === 'pending-approval'
        );
        const transferred = data.data.filter(project => 
          ['transferring', 'transferred'].includes(project.status)
        );
        const completed = data.data.filter(project => 
          project.status === 'completed'
        );
        
        setProjectsData({
          inProgressProjects: inProgress,
          pendingApprovalProjects: pendingApproval,
          transferredProjects: transferred,
          completedProjects: completed
        });
      } else {
        console.error('Failed to fetch technician projects:', data.message);
      }
    } catch (err) {
      console.error('Error fetching technician projects:', err);
    }
  };
  
  useEffect(() => {
    if (isOpen && technicianId) {
      fetchTechnician();
    } else {
      // Reset state when modal closes
      setTechnician(null);
      setError(null);
      setProjectsData({
        inProgressProjects: [],
        pendingApprovalProjects: [],
        transferredProjects: [],
        completedProjects: []
      });
    }
  }, [isOpen, technicianId]);
  
  const handleViewProject = async (project) => {
    try {
      setLoading(true);
      
      // Fetch full project details
      const response = await fetch(`${SummaryApi.getWorkOrderDetails.url}/${project.customerId}/${project.orderId}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedProject(data.data);
        setShowProjectDetailsModal(true);
      } else {
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
  
  // Function to navigate to edit page
  const handleEditTechnician = () => {
    setShowEditModal(true);
  };

  // Add this function to handle successful update
const handleTechnicianUpdated = () => {
  // Refresh technician data
  fetchTechnician();
  // Close the edit modal
  setShowEditModal(false);
  // Call the onTechnicianUpdated prop if provided
  onTechnicianUpdated && onTechnicianUpdated();
};
  
  // Get status badge style
  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending-approval':
        return 'bg-yellow-100 text-yellow-800';
      case 'assigned':
        return 'bg-blue-100 text-blue-800';
      case 'in-progress':
        return 'bg-purple-100 text-purple-800';
      case 'paused':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Technician Details"
      size="xl"
    >
      {loading && !technician ? (
        <div className="p-6 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="p-6">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        </div>
      ) : technician ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-2">
          {/* Technician info panel - Left side */}
          <div className="lg:col-span-1 bg-white rounded-lg border overflow-hidden border-t-4 border-indigo-500">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold">{technician.firstName} {technician.lastName}</h2>
                  <div className="text-sm text-gray-500 mt-1">
                    {formatDate(technician.createdAt)}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  technician.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {technician.status}
                </span>
              </div>
              
              {/* Technician info */}
              <div className="space-y-4 mt-6">
                <div className="flex items-start">
                  <div className="mt-1 mr-3 text-gray-500">👤</div>
                  <div>
                    <div className="text-sm text-gray-500">Username</div>
                    <div>{technician.username}</div>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="mt-1 mr-3 text-gray-500">📧</div>
                  <div>
                    <div className="text-sm text-gray-500">Email</div>
                    <div>{technician.email}</div>
                  </div>
                </div>
                
                {technician.phone && (
                  <div className="flex items-start">
                    <div className="mt-1 mr-3 text-gray-500">📱</div>
                    <div>
                      <div className="text-sm text-gray-500">Phone</div>
                      <div>{technician.phone}</div>
                    </div>
                  </div>
                )}
                
                {technician.branch && (
                  <div className="flex items-start">
                    <div className="mt-1 mr-3 text-gray-500">🏢</div>
                    <div>
                      <div className="text-sm text-gray-500">Branch</div>
                      <div>{typeof technician.branch === 'object' ? technician.branch.name : 'Unknown'}</div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-8 space-y-3">
                <button
                  onClick={handleEditTechnician}
                  className="w-full py-2 px-4 border border-gray-300 rounded-md flex items-center justify-center text-gray-700 hover:bg-gray-50"
                >
                  <FiEdit2 className="mr-2" />
                  Edit Technician
                </button>
              </div>
            </div>
          </div>
          
          {/* Projects panel - Right side */}
          <div className="lg:col-span-2 bg-white rounded-lg overflow-hidden border border-gray-200">
  <div className="p-6">
    <h2 className="text-xl font-semibold mb-6">Projects</h2>
    
    {/* Projects table */}
    {projectsData.inProgressProjects.length === 0 && 
     projectsData.pendingApprovalProjects.length === 0 && 
     projectsData.transferredProjects.length === 0 &&
     projectsData.completedProjects.length === 0 ? (
      <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
        No projects found for this technician.
      </div>
    ) : (
      <div className="mb-6 max-h-[400px] overflow-y-auto">
        <div className="overflow-visible">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sr.No
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project Name
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
            {[
  ...projectsData.inProgressProjects,
  ...projectsData.pendingApprovalProjects,
  ...projectsData.transferredProjects,
  ...projectsData.completedProjects
]
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  .map((project, index) => {
    // यहां unique identifier समझ लेते हैं (project._id या orderId)
    const projectId = project._id || project.orderId || `project-${index}`;
    
    return (
      <React.Fragment key={projectId}>
        <tr 
          onClick={() => setExpandedRow(expandedRow === projectId ? null : projectId)}
          className={`hover:bg-gray-50 cursor-pointer ${
            expandedRow === projectId ? 'bg-gray-50' : ''
          }`}
        >
          <td className="px-2 py-3 whitespace-nowrap">
            <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center text-white font-medium">
              {index + 1}
            </div>
          </td>
          <td className="px-4 py-3">
            <div className="text-sm text-gray-700">
              {project.projectType}
            </div>
            <div className="text-xs text-gray-500">
          {project.projectCategory === 'Repair' ? 'Complaint' : 'New Installation'}
        </div>
          </td>
          <td className="px-4 py-3">
            <div className="text-sm text-gray-700">
              {project.customerName}
            </div>
            <div className="text-xs text-gray-500">
              {project.customerPhone || (project.phoneNumber ? '+' + project.phoneNumber : 'No phone')}
            </div>
          </td>
          <td className="px-4 py-3">
            <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${
              project.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              project.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
              project.status === 'in-progress' ? 'bg-purple-100 text-purple-800' :
              project.status === 'paused' ? 'bg-orange-100 text-orange-800' :
              project.status === 'transferred' ? 'bg-red-100 text-red-800' :
              project.status === 'completed' ? 'bg-green-100 text-green-800' :
              project.status === 'pending-approval' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {project.status}
            </span>
            {project.status === 'completed' && (
              <div className="text-xs text-gray-500 mt-1">
                {formatDate(project.completedAt || project.updatedAt)}
              </div>
            )}
          </td>
        </tr>
        {expandedRow === projectId && (
          <tr>
            <td colSpan="5" className="px-6 py-4 bg-gray-50 border-b">
              <div className="flex space-x-3">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewProject(project);
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
    );
  })
}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
</div>
        </div>
      ) : (
        <div className="p-6 text-center text-gray-500">
          Technician not found
        </div>
      )}
      
      {/* Project Details Modal */}
      {showProjectDetailsModal && (
        <ProjectDetailsModal 
          isOpen={showProjectDetailsModal}
          onClose={() => {
            setShowProjectDetailsModal(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
          onProjectApproved={() => {
            // Refresh projects after approval
            fetchTechnicianProjects(technicianId);
            setShowProjectDetailsModal(false);
          }}
        />
      )}

{showEditModal && (
  <EditTechnicianModal
    isOpen={showEditModal}
    onClose={() => setShowEditModal(false)}
    technicianId={technicianId}
    onSuccess={handleTechnicianUpdated}
  />
)}
    </Modal>  
  );
};

export default TechnicianDetailModal;