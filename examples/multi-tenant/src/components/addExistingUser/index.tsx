'use client'
import React, { useState, useEffect } from 'react';
import { useField, SelectInput } from '@payloadcms/ui';

 export const ExistingUserSelect = ({ path }: { path: string }) => {
    const { value, setValue } = useField<string | string[]>({ path });
    const [ options, setOptions ] = useState([]);
    const isError = !value;


    useEffect(() => {
        const fetchUsers = async () => {
            try {
            const response = await fetch ('/api/users');
            const data = await response.json();
            const userOptions = data.docs.map(user => ({
                label: user.email,
                value: user.id,
            }));
            setOptions(userOptions);
        } catch (error) {
            console.error('Error fetching users', error);
        }
        };
        fetchUsers();
    }, []);

    return (
        <div>
            <label className='field-label'>Select Existing User <span style={{ color: 'red' }}>*</span></label>
             
            
            <SelectInput path={path} name={path} options={options} value={value} onChange={selectedOption => setValue(selectedOption?.value || '')} />
                {isError && <span className='error'>This field is required</span>}
        </div>
    )


 }
