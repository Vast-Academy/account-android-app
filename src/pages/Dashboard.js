import React, { useEffect, useState } from "react";
import {
  FiUsers,
  FiPackage,
  FiTool,
  FiDollarSign,
  FiFileText,
  FiCheckCircle,
  FiActivity,
  FiClock,
  FiUserPlus,
  FiClipboard,
  FiHome,
} from "react-icons/fi";
import SummaryApi from "../common";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import MarkUpdateForm from "../components/MarkUpdateForm";

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [technicianStats, setTechnicianStats] = useState([]);
  const [branchStats, setBranchStats] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Stats state with initial values
  const [stats, setStats] = useState({
    branches: 0,
    staff: 0,
    leads: 0,
    customers: 0,
    technicians: 0,
    inventory: 0,
    workOrders: 0,
    assignedProjects: 0,
    pendingApprovals: 0,
    completedProjects: 0,
  });

  // Customer summary data
  const [customerSummary, setCustomerSummary] = useState({
    total: 0,
    active: 0,
    pending: 0,
  });

  // Last refresh time tracking
  const [lastRefreshTime, setLastRefreshTime] = useState({
    branches: 0,
    staff: 0,
    leads: 0,
    customers: 0,
    inventory: 0,
    workOrders: 0,
    projects: 0,
  });

  // Other dashboard data
  const [recentOrders, setRecentOrders] = useState([]);
  const [inventoryStatus, setInventoryStatus] = useState([]);

  // Cache staleness time - 15 minutes
  const CACHE_STALENESS_TIME = 15 * 60 * 1000;

  // Main function to fetch dashboard data with caching
  const fetchDashboardData = async (forceFresh = false) => {
    try {
      setError(null);

      // Check for cached data
      const cachedDashboardData = localStorage.getItem("dashboardData");

      // Use cached data if available and not forcing fresh data
      if (!forceFresh && cachedDashboardData) {
        const parsedData = JSON.parse(cachedDashboardData);

        // Set all the states from cache
        setStats(parsedData.stats || {});
        setCustomerSummary(parsedData.customerSummary || {});
        setBranchStats(parsedData.branchStats || []);
        setTechnicianStats(parsedData.technicianStats || []);

        // Fetch fresh data in background without updating loading state
        fetchFreshDashboardDataInBackground();

        setLoading(false);
        return;
      }

      // If no valid cache or force fresh, fetch new data
      await fetchFreshDashboardData();
    } catch (err) {
      // Try to use cached data as fallback if API fails
      const cachedDashboardData = localStorage.getItem("dashboardData");
      if (cachedDashboardData) {
        const parsedData = JSON.parse(cachedDashboardData);
        setStats(parsedData.stats || {});
        setCustomerSummary(parsedData.customerSummary || {});
        setBranchStats(parsedData.branchStats || []);
        setTechnicianStats(parsedData.technicianStats || []);
        console.log("Using cached dashboard data after fetch error");
      } else {
        console.error("Error fetching dashboard data:", err);
        setError("Server error. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch fresh dashboard data in background
  const fetchFreshDashboardDataInBackground = async () => {
    try {
      // Perform all API calls but don't update loading state
      await fetchFreshDashboardData(true); // true means this is a background fetch
    } catch (err) {
      console.error("Error fetching dashboard data in background:", err);
    }
  };

  // Function to fetch fresh dashboard data directly from API
  const fetchFreshDashboardData = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }

    try {
      // For admin, fetch all branches first
      let allBranches = [];
      if (user.role === "admin") {
        try {
          const branchResponse = await fetch(SummaryApi.getBranches.url, {
            method: SummaryApi.getBranches.method,
            credentials: "include",
          });

          const branchData = await branchResponse.json();
          if (branchData.success) {
            allBranches = branchData.data || [];
            // console.log("Fetched branches:", allBranches);
          }
        } catch (err) {
          console.error("Error fetching branches:", err);
        }
      }

      // Include branch parameter if admin has selected a branch
      let branchParam = "";
      if (user.role === "admin" && user.selectedBranch) {
        branchParam = `?branch=${user.selectedBranch}`;
      }

      // Fetch data in parallel to improve performance
      const [
        leadsResponse,
        customersResponse,
        inventoryResponse,
        workOrdersResponse,
        projectsResponse,
      ] = await Promise.all([
        // 1. Fetch leads data
        fetch(`${SummaryApi.getAllLeads.url}${branchParam}`, {
          method: SummaryApi.getAllLeads.method,
          credentials: "include",
        }),

        // 2. Fetch customers data
        fetch(`${SummaryApi.getAllCustomers.url}${branchParam}`, {
          method: SummaryApi.getAllCustomers.method,
          credentials: "include",
        }),

        // 3. Fetch inventory data (combining serialized and generic)
        Promise.all([
          fetch(`${SummaryApi.getInventoryByType.url}/serialized-product`, {
            method: SummaryApi.getInventoryByType.method,
            credentials: "include",
          }),
          fetch(`${SummaryApi.getInventoryByType.url}/generic-product`, {
            method: SummaryApi.getInventoryByType.method,
            credentials: "include",
          }),
        ]),

        // 4. Fetch work orders
        fetch(`${SummaryApi.getWorkOrders.url}${branchParam}`, {
          method: SummaryApi.getWorkOrders.method,
          credentials: "include",
        }),

        // 5. Fetch all projects
        fetch(`${SummaryApi.getManagerProjects.url}${branchParam}`, {
          method: "GET",
          credentials: "include",
        }),
      ]);

      // Parse all responses
      const leadsData = await leadsResponse.json();
      const customersData = await customersResponse.json();

      // Parse inventory responses
      const [serializedResponse, genericResponse] = inventoryResponse;
      const serializedData = await serializedResponse.json();
      const genericData = await genericResponse.json();

      const workOrdersData = await workOrdersResponse.json();
      const projectsData = await projectsResponse.json();

      // Initialize variables for stats
      let branchesCount = 0;
      let totalStaff = 0;
      let inventoryTotal = 0;
      let customersCount = 0;
      let pendingWorkOrdersCount = 0;
      let assignedCount = 0;
      let pendingApprovalCount = 0;
      let completedCount = 0;
      let leadsCount = 0;
      let techniciansCount = 0;
      let branchStatsArray = [];
      let technicians = [];

      // Calculate counts for admin dashboard
      if (user.role === "admin") {
        // Count branches
        branchesCount = allBranches.length;

        // For admin, we need to separately fetch managers and technicians
        try {
          // Fetch managers
          const managersResponse = await fetch(SummaryApi.getManagerUsers.url, {
            method: SummaryApi.getManagerUsers.method,
            credentials: "include",
          });

          // Fetch technicians
          const techniciansResponse = await fetch(
            SummaryApi.getTechnicianUsers.url,
            {
              method: SummaryApi.getTechnicianUsers.method,
              credentials: "include",
            }
          );

          const managersData = await managersResponse.json();
          const techniciansData = await techniciansResponse.json();

          // Calculate total active staff
          let managersCount = 0;

          if (managersData.success) {
            managersCount = managersData.data.filter(
              (m) => m.status === "active"
            ).length;
          }

          if (techniciansData.success) {
            techniciansCount = techniciansData.data.filter(
              (t) => t.status === "active"
            ).length;
          }

          totalStaff = managersCount + techniciansCount;
        } catch (err) {
          console.error("Error fetching staff data:", err);
        }

        // Calculate inventory total
        if (serializedData.success) {
          serializedData.items.forEach((item) => {
            if (item.stock) {
              inventoryTotal += item.stock.length;
            }
          });
        }

        if (genericData.success) {
          genericData.items.forEach((item) => {
            if (item.stock) {
              item.stock.forEach((stock) => {
                inventoryTotal += parseInt(stock.quantity || 0, 10);
              });
            }
          });
        }

        // Calculate customer count
        customersCount = customersData.success ? customersData.data.length : 0;

        // Calculate pending work orders count
        pendingWorkOrdersCount = workOrdersData.success
          ? workOrdersData.data.filter(
              (order) =>
                order.status === "pending" || order.status === "Pending"
            ).length
          : 0;

        // Calculate project counts
        if (projectsData.success) {
          const validProjects = projectsData.data.filter((project) => {
            return (
              project.technician &&
              (project.technician.firstName ||
                project.technician.lastName ||
                (typeof project.technician === "string" &&
                  project.technician.length > 0))
            );
          });

          assignedCount = validProjects.filter((project) =>
            ["assigned", "in-progress", "paused"].includes(project.status)
          ).length;

          pendingApprovalCount = validProjects.filter(
            (project) => project.status === "pending-approval"
          ).length;

          completedCount = validProjects.filter(
            (project) => project.status === "completed"
          ).length;
        }

        // Set admin stats
        const adminStats = {
          branches: branchesCount,
          staff: totalStaff,
          leads: leadsData.success ? leadsData.data.length : 0,
          customers: customersCount,
          inventory: inventoryTotal,
          workOrders: pendingWorkOrdersCount,
          assignedProjects: assignedCount,
          pendingApprovals: pendingApprovalCount,
          completedProjects: completedCount,
        };

        setStats(adminStats);

        // Process branch stats for admin overview table
        if (projectsData.success) {
          // Create a branch stats map to track project counts by branch
          const branchStatsMap = {};

          // Initialize the map with zero counts for each branch
          allBranches.forEach((branch) => {
            branchStatsMap[branch._id] = {
              id: branch._id,
              name: branch.name,
              assigned: 0,
              inProgress: 0,
              pendingApproval: 0,
              completed: 0,
              transferring: 0,
              transferred: 0,
            };
          });

          // console.log("Projects data:", projectsData.data.length);

          // Loop through all projects and count them by branch and status
          projectsData.data.forEach((project) => {
            // Get the branch ID from the project
            const branchId = project.branch && project.branch._id;

            if (branchId && branchStatsMap[branchId]) {
              // console.log(`Found project for branch ${branchId}, status: ${project.status}`);

              // Update the appropriate counter based on project status
              if (project.status === "assigned") {
                branchStatsMap[branchId].assigned++;
              } else if (project.status === "in-progress") {
                branchStatsMap[branchId].inProgress++;
              } else if (project.status === "pending-approval") {
                branchStatsMap[branchId].pendingApproval++;
              } else if (project.status === "completed") {
                branchStatsMap[branchId].completed++;
              } else if (project.status === "transferring") {
                branchStatsMap[branchId].transferring++;
              } else if (project.status === "transferred") {
                branchStatsMap[branchId].transferred++;
              }
            } else {
              console.log(
                `Project with missing or invalid branch ID: ${JSON.stringify(
                  project.branch
                )}`
              );
            }
          });

          // Convert the map to an array for rendering
          branchStatsArray = Object.values(branchStatsMap);
          // console.log("Branch stats array:", branchStatsArray);
          setBranchStats(branchStatsArray);
        }
      } else {
        // Manager dashboard stats calculation
        // Fetch technicians for manager's branch
        const techniciansResponse = await fetch(
          SummaryApi.getManagerTechnician.url,
          {
            method: "GET",
            credentials: "include",
          }
        );

        const techniciansData = await techniciansResponse.json();
        techniciansCount = techniciansData.success
          ? techniciansData.data.length
          : 0;

        leadsCount = leadsData.success ? leadsData.data.length : 0;
        customersCount = customersData.success ? customersData.data.length : 0;

        // Calculate inventory total
        if (serializedData.success) {
          serializedData.items.forEach((item) => {
            if (item.stock) {
              inventoryTotal += item.stock.length;
            }
          });
        }

        if (genericData.success) {
          genericData.items.forEach((item) => {
            if (item.stock) {
              item.stock.forEach((stock) => {
                inventoryTotal += parseInt(stock.quantity || 0, 10);
              });
            }
          });
        }

        // Calculate work orders count
        pendingWorkOrdersCount = workOrdersData.success
          ? workOrdersData.data.filter(
              (order) =>
                order.status === "pending" || order.status === "Pending"
            ).length
          : 0;

        // Calculate project counts for manager
        if (projectsData.success) {
          // Only count projects that have technicians assigned
          const validProjects = projectsData.data.filter((project) => {
            return (
              project.technician &&
              (project.technician.firstName ||
                project.technician.lastName ||
                (typeof project.technician === "string" &&
                  project.technician.length > 0))
            );
          });

          assignedCount = validProjects.filter((project) =>
            ["assigned", "in-progress", "paused"].includes(project.status)
          ).length;

          pendingApprovalCount = validProjects.filter(
            (project) => project.status === "pending-approval"
          ).length;

          completedCount = validProjects.filter(
            (project) => project.status === "completed"
          ).length;
        }

        // Set manager stats
        const managerStats = {
          leads: leadsCount,
          customers: customersCount,
          technicians: techniciansCount,
          inventory: inventoryTotal,
          workOrders: pendingWorkOrdersCount,
          assignedProjects: assignedCount,
          pendingApprovals: pendingApprovalCount,
          completedProjects: completedCount,
        };

        setStats(managerStats);

        // Calculate technician stats for manager view
        if (techniciansData.success && projectsData.success) {
          // Map technicians to get their names
          technicians = techniciansData.data.map((tech) => ({
            id: tech._id,
            name: `${tech.firstName} ${tech.lastName}`,
            assigned: 0,
            inProgress: 0,
            pendingApproval: 0,
            completed: 0,
            transferring: 0,
            transferred: 0,
          }));

          // Count projects for each technician
          projectsData.data.forEach((project) => {
            if (project.technician && project.technician._id) {
              const techIndex = technicians.findIndex(
                (t) => t.id === project.technician._id
              );
              if (techIndex !== -1) {
                // Update counters based on project status
                if (project.status === "assigned") {
                  technicians[techIndex].assigned++;
                } else if (project.status === "in-progress") {
                  technicians[techIndex].inProgress++;
                } else if (project.status === "pending-approval") {
                  technicians[techIndex].pendingApproval++;
                } else if (project.status === "completed") {
                  technicians[techIndex].completed++;
                } else if (project.status === "transferring") {
                  technicians[techIndex].transferring++;
                } else if (project.status === "transferred") {
                  technicians[techIndex].transferred++;
                }
              }
            }
          });

          setTechnicianStats(technicians);
        }
      }

      // Set customer summary data
      const customerSummaryData = {
        total: customersCount,
        active: customersCount,
        pending: 0,
      };

      setCustomerSummary(customerSummaryData);

      // Update refresh times
      setLastRefreshTime({
        branches: new Date().getTime(),
        leads: new Date().getTime(),
        customers: new Date().getTime(),
        inventory: new Date().getTime(),
        workOrders: new Date().getTime(),
        projects: new Date().getTime(),
      });

      // Cache the dashboard data
      const dashboardDataToCache = {
        stats:
          user.role === "admin"
            ? {
                branches: branchesCount,
                staff: totalStaff,
                leads: leadsData.success ? leadsData.data.length : 0,
                customers: customersCount,
                inventory: inventoryTotal,
                workOrders: pendingWorkOrdersCount,
                assignedProjects: assignedCount,
                pendingApprovals: pendingApprovalCount,
                completedProjects: completedCount,
              }
            : {
                leads: leadsCount,
                customers: customersCount,
                technicians: techniciansCount,
                inventory: inventoryTotal,
                workOrders: pendingWorkOrdersCount,
                assignedProjects: assignedCount,
                pendingApprovals: pendingApprovalCount,
                completedProjects: completedCount,
              },
        customerSummary: customerSummaryData,
        branchStats: user.role === "admin" ? branchStatsArray : [],
        technicianStats: user.role !== "admin" ? technicians : [],
      };

      localStorage.setItem(
        "dashboardData",
        JSON.stringify(dashboardDataToCache)
      );
      // localStorage.setItem('dashboardDataTimestamp', new Date().getTime().toString());
    } catch (err) {
      console.error("Error fetching fresh dashboard data:", err);
      throw err;
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  // Load dashboard data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, [user.role, user.selectedBranch]);

  // Define the dashboard stat boxes based on the role
  const dashboardStats =
    user.role === "admin"
      ? [
          {
            name: "Total Branches",
            value: stats.branches,
            icon: FiHome,
            bgColor: "bg-indigo-500",
            path: "/branches",
          },
          {
            name: "Total Staff",
            value: stats.staff,
            icon: FiUsers,
            bgColor: "bg-blue-500",
            path: "/users/managers",
          },
          {
            name: "Inventory Items",
            value: stats.inventory,
            icon: FiPackage,
            bgColor: "bg-yellow-500",
            path: "/inventory",
          },
          {
            name: "Customers",
            value: stats.customers,
            icon: FiUsers,
            bgColor: "bg-green-500",
            path: "/contacts",
          },
          {
            name: "Work Orders",
            value: stats.workOrders,
            icon: FiTool,
            bgColor: "bg-red-500",
            path: "/work-orders",
          },
          {
            name: "Assigned Projects",
            value: stats.assignedProjects,
            icon: FiActivity,
            bgColor: "bg-purple-500",
            path: "/manager-dashboard",
          },
          {
            name: "Pending Approvals",
            value: stats.pendingApprovals,
            icon: FiClock,
            bgColor: "bg-amber-500",
            path: "/manager-dashboard",
          },
          {
            name: "Completed Projects",
            value: stats.completedProjects,
            icon: FiCheckCircle,
            bgColor: "bg-emerald-500",
            path: "/manager-dashboard",
          },
        ]
      : [
          // Manager dashboard stats
          {
            name: "Active Leads",
            value: stats.leads,
            icon: FiUsers,
            bgColor: "bg-blue-500",
            path: "/contacts",
          },
          {
            name: "Customers",
            value: stats.customers,
            icon: FiUsers,
            bgColor: "bg-green-500",
            path: "/contacts",
          },
          {
            name: "Technicians",
            value: stats.technicians,
            icon: FiUsers,
            bgColor: "bg-purple-500",
            path: "/users/technicians",
          },
          {
            name: "Inventory Items",
            value: stats.inventory,
            icon: FiPackage,
            bgColor: "bg-yellow-500",
            path: "/inventory",
          },
          {
            name: "Pending Work Orders",
            value: stats.workOrders,
            icon: FiTool,
            bgColor: "bg-red-500",
            path: "/work-orders",
          },
          {
            name: "Assigned Projects",
            value: stats.assignedProjects,
            icon: FiActivity,
            bgColor: "bg-indigo-500",
            path: "/manager-dashboard",
          },
          {
            name: "Pending Approvals",
            value: stats.pendingApprovals,
            icon: FiClock,
            bgColor: "bg-amber-500",
            path: "/manager-dashboard",
          },
          {
            name: "Completed Projects",
            value: stats.completedProjects,
            icon: FiCheckCircle,
            bgColor: "bg-emerald-500",
            path: "/manager-dashboard",
          },
        ];

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
          <p className="text-gray-600">Welcome back to your CRM dashboard</p>
        </div>

        <div className="flex space-x-2">
        <button
        onClick={() => {
          console.log("Button clicked");
          setShowModal(true);
        }}
        className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
      >
        Mark Update Available
      </button>
      
      {/* Modal as a portal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <div className="flex justify-between">
              <h2 className="text-lg font-bold">Mark Update Available</h2>
              <button onClick={() => setShowModal(false)}>✕</button>
            </div>
            <MarkUpdateForm />
          </div>
        </div>
      )}

          {/* Refresh button */}
          <button
            onClick={() => fetchFreshDashboardData()}
            className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center"
            title="Refresh Dashboard Data"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {dashboardStats.map((stat, index) => (
          <div
            key={index}
            className={`${stat.bgColor} text-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300 cursor-pointer`}
            onClick={() => (window.location.href = stat.path)}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-white text-opacity-80">
                  {stat.name}
                </p>
                <p className="text-2xl font-bold mt-2">{stat.value}</p>
              </div>
              <stat.icon className="w-10 h-10 text-white text-opacity-75" />
            </div>
          </div>
        ))}
      </div>

      {/* Branch/Technician Overview */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          {user.role === "admin" ? "Branch Overview" : "Technicians Overview"}
        </h2>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {user.role === "admin" ? "BRANCH" : "NAME"}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ASSIGNED
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IN PROGRESS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PENDING APPROVAL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  COMPLETED
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TRANSFERRING
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TRANSFERRED
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {user.role === "admin"
                ? // Admin view - branches data
                  branchStats.map((branch) => (
                    <tr key={branch.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {branch.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {branch.assigned}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {branch.inProgress}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {branch.pendingApproval}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {branch.completed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {branch.transferring}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {branch.transferred}
                      </td>
                    </tr>
                  ))
                : // Manager view - technicians data
                  technicianStats.map((tech) => (
                    <tr key={tech.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {tech.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tech.assigned}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tech.inProgress}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tech.pendingApproval}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tech.completed}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tech.transferring}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {tech.transferred}
                      </td>
                    </tr>
                  ))}

              {/* Add a total row at the bottom */}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  Total
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.role === "admin"
                    ? branchStats.reduce(
                        (sum, branch) => sum + branch.assigned,
                        0
                      )
                    : technicianStats.reduce(
                        (sum, tech) => sum + tech.assigned,
                        0
                      )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.role === "admin"
                    ? branchStats.reduce(
                        (sum, branch) => sum + branch.inProgress,
                        0
                      )
                    : technicianStats.reduce(
                        (sum, tech) => sum + tech.inProgress,
                        0
                      )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.role === "admin"
                    ? branchStats.reduce(
                        (sum, branch) => sum + branch.pendingApproval,
                        0
                      )
                    : technicianStats.reduce(
                        (sum, tech) => sum + tech.pendingApproval,
                        0
                      )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.role === "admin"
                    ? branchStats.reduce(
                        (sum, branch) => sum + branch.completed,
                        0
                      )
                    : technicianStats.reduce(
                        (sum, tech) => sum + tech.completed,
                        0
                      )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.role === "admin"
                    ? branchStats.reduce(
                        (sum, branch) => sum + branch.transferring,
                        0
                      )
                    : technicianStats.reduce(
                        (sum, tech) => sum + tech.transferring,
                        0
                      )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.role === "admin"
                    ? branchStats.reduce(
                        (sum, branch) => sum + branch.transferred,
                        0
                      )
                    : technicianStats.reduce(
                        (sum, tech) => sum + tech.transferred,
                        0
                      )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
