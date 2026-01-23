import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiLoader, FiMail, FiPhone, FiUserCheck, FiClock, FiCheck, FiShield, FiRefreshCw } from 'react-icons/fi';
import { Building } from 'lucide-react';
import SummaryApi from '../../common';

const ManagerDetail = () => {
  const { managerId } = useParams();
  const navigate = useNavigate();
  const [manager, setManager] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // New state for branch performance
  const [branchPerformance, setBranchPerformance] = useState({
    teamSize: 0,
    workOrders: 0,
    assigned: 0,
    pendingApproval: 0,
    completed: 0,
    transferring: 0,
    transferred: 0
  });
  
  // New state for team overview
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamTotals, setTeamTotals] = useState({
    assigned: 0,
    inProgress: 0,
    pendingApproval: 0,
    completed: 0,
    transferring: 0,
    transferred: 0
  });
  // Add to state variables at the top
const [branchSummary, setBranchSummary] = useState({
  teamSize: 0,
  workOrders: 0,  // This will be unassigned pending orders
  completedProjects: 0,
  ongoingProjects: 0 // Sum of assigned, in-progress, pending-approval
});

  useEffect(() => {
    fetchManagerData();
  }, [managerId]);

  const fetchManagerData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${SummaryApi.getManagerById.url}/${managerId}`, {
        method: SummaryApi.getManagerById.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        setManager(data.data);
        
        // If manager has a branch, fetch performance data
        if (data.data.branch && data.data.branch._id) {
          fetchBranchPerformance(data.data.branch._id);
          fetchTeamOverview(data.data.branch._id);
          fetchBranchSummary(data.data.branch._id);
        }
      } else {
        setError(data.message || 'Failed to fetch manager details');
      }
    } catch (err) {
      setError('Server error. Please try again later.');
      console.error('Error fetching manager details:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // New function to fetch branch performance metrics
  const fetchBranchPerformance = async (branchId) => {
    if (!branchId) return;
    
    try {
      // Fetch technician count (team size)
      const techResponse = await fetch(`${SummaryApi.getManagerTechnician.url}?branch=${branchId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const techData = await techResponse.json();
      const teamSize = techData.success ? techData.data.length : 0;
      
      // Fetch projects data for the branch
      const projectsResponse = await fetch(`${SummaryApi.getManagerProjects.url}?branch=${branchId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const projectsData = await projectsResponse.json();
      
      if (projectsData.success) {
        const projects = projectsData.data || [];
        
        // Count projects by status
        const assigned = projects.filter(p => ['assigned', 'in-progress'].includes(p.status)).length;
        const pendingApproval = projects.filter(p => p.status === 'pending-approval').length;
        const completed = projects.filter(p => p.status === 'completed').length;
        const transferring = projects.filter(p => p.status === 'transferring').length;
        const transferred = projects.filter(p => p.status === 'transferred').length;

        // Fetch unassigned pending work orders
    const workOrdersResponse = await fetch(`${SummaryApi.getWorkOrders.url}?branch=${branchId}&status=pending`, {
      method: 'GET',
      credentials: 'include',
    });
    
    const workOrdersData = await workOrdersResponse.json();
    let pendingWorkOrders = 0;
    
    if (workOrdersData.success) {
      // Important: Filter to match WorkOrdersPage criteria - pending orders with no technician
      const pendingOrders = workOrdersData.data || [];
      pendingWorkOrders = pendingOrders.filter(order => 
        (order.status === 'pending' || order.status === 'Pending') && 
        (!order.technician || 
         (typeof order.technician === 'object' && !order.technician.firstName && !order.technician.lastName) ||
         (typeof order.technician === 'string' && order.technician.trim() === ''))
      ).length;
    }
        
        setBranchPerformance({
          teamSize,
          workOrders: pendingWorkOrders,
          assigned,
          pendingApproval,
          completed,
          transferring,
          transferred
        });
      }
    } catch (err) {
      console.error('Error fetching branch performance:', err);
    }
  };
  
  // New function to fetch team overview data
  const fetchTeamOverview = async (branchId) => {
    if (!branchId) return;
    
    try {
      // Fetch technicians in this branch
      const techResponse = await fetch(`${SummaryApi.getManagerTechnician.url}?branch=${branchId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const techData = await techResponse.json();
      
      if (techData.success && techData.data.length > 0) {
        const technicians = techData.data;
        
        // For each technician, fetch their projects
        const technicianWithProjects = await Promise.all(
          technicians.map(async (tech) => {
            try {
              const projectsResponse = await fetch(`${SummaryApi.getTechnicianProjects.url}/${tech._id}`, {
                method: 'GET',
                credentials: 'include'
              });
              
              const projectsData = await projectsResponse.json();
              
              if (projectsData.success) {
                const projects = projectsData.data || [];
                
                // Count projects by status
                const assigned = projects.filter(p => p.status === 'assigned').length;
                const inProgress = projects.filter(p => p.status === 'in-progress').length;
                const pendingApproval = projects.filter(p => p.status === 'pending-approval').length;
                const completed = projects.filter(p => p.status === 'completed').length;
                const transferring = projects.filter(p => p.status === 'transferring').length;
                const transferred = projects.filter(p => p.status === 'transferred').length;
                
                return {
                  ...tech,
                  performance: {
                    assigned,
                    inProgress,
                    pendingApproval,
                    completed,
                    transferring,
                    transferred
                  }
                };
              }
              
              return {
                ...tech,
                performance: {
                  assigned: 0,
                  inProgress: 0,
                  pendingApproval: 0,
                  completed: 0,
                  transferring: 0,
                  transferred: 0
                }
              };
            } catch (err) {
              console.error(`Error fetching projects for technician ${tech._id}:`, err);
              return {
                ...tech,
                performance: {
                  assigned: 0,
                  inProgress: 0,
                  pendingApproval: 0,
                  completed: 0,
                  transferring: 0,
                  transferred: 0
                }
              };
            }
          })
        );
        
        setTeamMembers(technicianWithProjects);
        
        // Calculate totals
        const totals = technicianWithProjects.reduce(
          (acc, tech) => {
            return {
              assigned: acc.assigned + tech.performance.assigned,
              inProgress: acc.inProgress + tech.performance.inProgress,
              pendingApproval: acc.pendingApproval + tech.performance.pendingApproval,
              completed: acc.completed + tech.performance.completed,
              transferring: acc.transferring + tech.performance.transferring,
              transferred: acc.transferred + tech.performance.transferred
            };
          },
          {
            assigned: 0,
            inProgress: 0,
            pendingApproval: 0,
            completed: 0,
            transferring: 0,
            transferred: 0
          }
        );
        
        setTeamTotals(totals);
      }
    } catch (err) {
      console.error('Error fetching team overview:', err);
    }
  };

  // Add this function after fetchTeamOverview
const fetchBranchSummary = async (branchId) => {
  if (!branchId) return;
  
  try {
    // Fetch technician count (team size)
    const techResponse = await fetch(`${SummaryApi.getManagerTechnician.url}?branch=${branchId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const techData = await techResponse.json();
    const teamSize = techData.success ? techData.data.length : 0;
    
    // Fetch projects data (assigned, in-progress, etc.)
    const projectsResponse = await fetch(`${SummaryApi.getManagerProjects.url}?branch=${branchId}`, {
      method: 'GET',
      credentials: 'include',
    });
    
    const projectsData = await projectsResponse.json();
    let completedProjects = 0;
    let ongoingProjects = 0;
    
    if (projectsData.success) {
      const projects = projectsData.data || [];
      
      // Count completed projects
      completedProjects = projects.filter(p => p.status === 'completed').length;
      
      // Count ongoing projects (assigned + in-progress + pending-approval)
      ongoingProjects = projects.filter(p => 
        ['assigned', 'in-progress', 'pending-approval'].includes(p.status)
      ).length;
    }
    
    // Fetch unassigned pending work orders
    const workOrdersResponse = await fetch(`${SummaryApi.getWorkOrders.url}?branch=${branchId}&status=pending`, {
      method: 'GET',
      credentials: 'include',
    });
    
    const workOrdersData = await workOrdersResponse.json();
    let pendingWorkOrders = 0;
    
    if (workOrdersData.success) {
      // Important: Filter to match WorkOrdersPage criteria - pending orders with no technician
      const pendingOrders = workOrdersData.data || [];
      pendingWorkOrders = pendingOrders.filter(order => 
        (order.status === 'pending' || order.status === 'Pending') && 
        (!order.technician || 
         (typeof order.technician === 'object' && !order.technician.firstName && !order.technician.lastName) ||
         (typeof order.technician === 'string' && order.technician.trim() === ''))
      ).length;
    }
    
    setBranchSummary({
      teamSize,
      workOrders: pendingWorkOrders,
      completedProjects,
      ongoingProjects
    });
  } catch (err) {
    console.error('Error fetching branch summary:', err);
  }
};

  // Get first letter of name for avatar
  const getInitial = (name) => {
    return name ? name.charAt(0).toUpperCase() : 'M';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <FiLoader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !manager) {
    return (
      <div className="bg-red-100 text-red-700 p-6 rounded-lg shadow-md">
        <p className="font-medium text-lg mb-2">Error</p>
        <p>{error || 'Manager not found'}</p>
        <button 
          onClick={() => navigate('/users/managers')}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Back to Managers
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Manager Details</h1>
      
      {/* Manager details card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row">
          {/* Left side - Manager info */}
          <div className="md:w-1/3 pr-6">
            <div className="flex items-start">
              <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-semibold mr-4">
                {getInitial(manager.firstName)}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{manager.firstName} {manager.lastName}</h2>
                <div className="flex items-center gap-1 text-gray-600 text-sm mt-1">
                  <Building size={18}/>
                  Manager at {manager.branch?.name || 'No Branch'} Branch
                </div>
                <span className="inline-block mt-2 px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                  {manager.status}
                </span>
              </div>
            </div>
            
            <div className="mt-6">
              <h3 className="font-medium text-gray-700 mb-3">Contact Information</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <FiMail className="text-gray-500 mr-2" />
                  <span className="text-sm text-gray-500">Email:</span>
                  <a href={`mailto:${manager.email}`} className="ml-1 text-blue-600">{manager.email}</a>
                </div>
                <div className="flex items-center">
                  <FiPhone className="text-gray-500 mr-2" />
                  <span className="text-sm text-gray-500">Phone:</span>
                  <span className="ml-1">{manager.phone || 'Not provided'}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right side - Branch Performance */}
          <div className="md:w-2/3 mt-6 md:mt-0">
  <h3 className="font-medium text-gray-700 mb-4">Branch Performance</h3>
  
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <div className="bg-gray-100 p-3 rounded-md">
      <div className="text-sm text-gray-600 mb-1">Team Size</div>
      <div className="flex items-center">
        <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <span className="text-xl font-bold">{branchPerformance.teamSize}</span>
      </div>
    </div>
    
    <div className="bg-gray-100 p-3 rounded-md">
      <div className="text-sm text-gray-600 mb-1">Work Orders</div>
      <div className="flex items-center">
        <svg className="w-5 h-5 mr-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <span className="text-xl font-bold">{branchPerformance.workOrders}</span>
      </div>
    </div>
    
    <div className="bg-blue-50 p-3 rounded-md">
      <div className="text-sm text-gray-600 mb-1">Assigned</div>
      <div className="flex items-center">
        <FiUserCheck className="w-5 h-5 mr-2 text-blue-600" />
        <span className="text-xl font-bold">{branchPerformance.assigned}</span>
      </div>
    </div>
    
    <div className="bg-yellow-50 p-3 rounded-md">
      <div className="text-sm text-gray-600 mb-1">Pending Approval</div>
      <div className="flex items-center">
        <FiClock className="w-5 h-5 mr-2 text-yellow-600" />
        <span className="text-xl font-bold">{branchPerformance.pendingApproval}</span>
      </div>
    </div>
  
    <div className="bg-green-50 p-3 rounded-md">
      <div className="text-sm text-gray-600 mb-1">Completed</div>
      <div className="flex items-center">
        <FiCheck className="w-5 h-5 mr-2 text-green-600" />
        <span className="text-xl font-bold">{branchPerformance.completed}</span>
      </div>
    </div>
    
    <div className="bg-orange-50 p-3 rounded-md">
      <div className="text-sm text-gray-600 mb-1">Transferring</div>
      <div className="flex items-center">
        <FiRefreshCw className="w-5 h-5 mr-2 text-orange-600" />
        <span className="text-xl font-bold">{branchPerformance.transferring}</span>
      </div>
    </div>
    
    <div className="bg-purple-50 p-3 rounded-md">
      <div className="text-sm text-gray-600 mb-1">Transferred</div>
      <div className="flex items-center">
        <FiShield className="w-5 h-5 mr-2 text-purple-600" />
        <span className="text-xl font-bold">{branchPerformance.transferred}</span>
      </div>
    </div>
  
    </div>
</div>
        </div>
      </div>
      
      {/* Team Overview Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-6">Team Overview</h2>
        
        {teamMembers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No team members found for this branch.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    In Progress
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pending Approval
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transferring
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transferred
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamMembers.map((tech) => (
                  <tr key={tech._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {tech.firstName} {tech.lastName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {tech.performance.assigned}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {tech.performance.inProgress}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {tech.performance.pendingApproval}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {tech.performance.completed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {tech.performance.transferring}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {tech.performance.transferred}
                    </td>
                  </tr>
                ))}
                
                {/* Totals row */}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-6 py-4 whitespace-nowrap">
                    Total
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {teamTotals.assigned}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {teamTotals.inProgress}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {teamTotals.pendingApproval}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {teamTotals.completed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {teamTotals.transferring}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {teamTotals.transferred}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Branch Summary Section */}
{/* <div className="bg-white rounded-lg shadow-md p-6 mt-6">
  <h2 className="text-xl font-semibold mb-6">Branch Summary</h2>
  
  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
    <div className="bg-blue-50 p-4 rounded-md">
      <h3 className="text-sm text-gray-600 mb-2">Team Size</h3>
      <p className="text-xl font-semibold">{branchSummary.teamSize} technicians</p>
    </div>
    
    <div className="bg-yellow-50 p-4 rounded-md">
      <h3 className="text-sm text-gray-600 mb-2">Work Orders</h3>
      <p className="text-xl font-semibold">{branchSummary.workOrders}</p>
    </div>
    
    <div className="bg-green-50 p-4 rounded-md">
      <h3 className="text-sm text-gray-600 mb-2">Completed Projects</h3>
      <p className="text-xl font-semibold">{branchSummary.completedProjects}</p>
    </div>
    
    <div className="bg-purple-50 p-4 rounded-md">
      <h3 className="text-sm text-gray-600 mb-2">Ongoing Projects</h3>
      <p className="text-xl font-semibold">{branchSummary.ongoingProjects}</p>
    </div>
  </div>
</div> */}

    </div>
  );
};

export default ManagerDetail;