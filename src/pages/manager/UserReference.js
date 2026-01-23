// UserReference.jsx - A reusable component to display user references

import React from 'react';

/**
 * A component to consistently display user references
 * Handles both populated user objects and string IDs
 */
const UserReference = ({ userRef, fallback = 'System', prefix = '', showId = false }) => {
  // Handle null or undefined case
  if (!userRef) {
    return <span>{fallback}</span>;
  }
  
  // Case 1: User reference is an object with firstName
  if (typeof userRef === 'object' && userRef?.firstName) {
    return (
      <span>
        {prefix && <span>{prefix} </span>}
        {`${userRef.firstName} ${userRef.lastName || ''}`}
        {showId && userRef._id && <span className="text-xs text-gray-500 ml-1">({userRef._id})</span>}
      </span>
    );
  }
  
  // Case 2: User reference is an object with only ID
  if (typeof userRef === 'object' && userRef?._id) {
    return (
      <span>
        {prefix && <span>{prefix} </span>}
        {`User`}
        <span className="text-xs text-gray-500 ml-1">(ID: {userRef._id})</span>
      </span>
    );
  }
  
  // Case 3: User reference is a string ID
  if (typeof userRef === 'string') {
    return (
      <span>
        {prefix && <span>{prefix} </span>}
        {`User`}
        <span className="text-xs text-gray-500 ml-1">(ID: {userRef})</span>
      </span>
    );
  }
  
  // Fallback for other cases
  return <span>{fallback}</span>;
};

export default UserReference;