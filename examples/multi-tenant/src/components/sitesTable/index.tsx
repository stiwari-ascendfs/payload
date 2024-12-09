// components/StatusCell.tsx

'use client'

import React, { useState } from 'react';
import { CustomCellProps } from '@payload-types';

const StatusCell: React.FC<CustomCellProps> = ({ cellData, rowData }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4CAF50';
      case 'pending':
        return '#FFC107';
      case 'inactive':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <div 
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
      style={{ position: 'relative' }}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px' 
      }}>
        <span style={{ 
          width: '10px', 
          height: '10px', 
          borderRadius: '50%', 
          backgroundColor: getStatusColor(cellData),
        }} />
        <span>{cellData}</span>
      </div>
      
      {showDetails && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          backgroundColor: 'white',
          padding: '12px',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 1000,
        }}>
          <p>Last Updated: {rowData.updatedAt}</p>
          <p>Created By: {rowData.createdBy}</p>
        </div>
      )}
    </div>
  );
};

export default StatusCell;
