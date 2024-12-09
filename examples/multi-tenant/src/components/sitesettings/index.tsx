'use client'

import React from 'react';
import { useDocumentInfo } from '@payloadcms/ui';
import { Button } from '@payloadcms/ui';


export const SettingsButton: React.FC = () => {
    const { id, collectionSlug, initialData } = useDocumentInfo(); // Use 'initialData' for document data
   
    
    if (!initialData?.settings) {
        return null;
    }
    const handleClick = async () => {
        if (collectionSlug === 'sites') {
            const siteSettingsId = initialData?.settings;

            console.log('siteSettingsId', siteSettingsId);

            if (siteSettingsId) {
                window.location.href = `/admin/collections/site-settings/${siteSettingsId}`;
            } else {
                // If settings don't exist, navigate to a default settings creation page
                window.location.href = `/admin/collections/site-settings/create`;
            }
        }
    };

    return (
        <Button 
            onClick={handleClick} 
            buttonStyle="primary"
        >
            Site Settings
        
        </Button>
    );
};
