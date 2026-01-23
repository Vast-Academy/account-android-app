import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

// This component serves as a redirection point for direct links to lead details
// It will redirect to the lead list page and open the detail modal via a query param
const LeadDetailRedirect = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    // Extract 'from' query param if it exists (for navigation history)
    const searchParams = new URLSearchParams(location.search);
    const from = searchParams.get('from');
    
    // Navigate to lead list with a state that indicates to open the lead detail modal
    navigate('/leads', { 
      state: { 
        openLeadDetail: true, 
        leadId: id,
        from 
      },
      replace: true
    });
  }, [id, navigate, location]);
  
  return (
    <div className="p-8 text-center">
      <p className="text-gray-600">Redirecting to lead management...</p>
    </div>
  );
};

export default LeadDetailRedirect;