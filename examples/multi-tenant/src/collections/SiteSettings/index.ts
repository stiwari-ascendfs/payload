import { CollectionConfig } from 'payload';
import { readAccess } from './access/accessSettings';
import { canMutatePage } from './access/byTenant'
import { ro } from 'payload/i18n/ro';
export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  access:{
    
    create: () => false,
    read: readAccess,
    update: canMutatePage,
    delete: () => false,
  },
  admin: {
    group: 'Network Admin',
    hidden: false,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Info',
          fields: [
            {
              name: 'siteId',
              type: 'relationship',
              relationTo: 'sites',
              required: true,
              hasMany: false,
              admin: {
                hidden: true
              }
            },
            {
              name: 'tenant',
              type: 'relationship',
              relationTo: 'tenants',
              required: true,
              admin: {
              
                description: 'Tenant to which this site belongs',
              }
            },
            {
              name: 'url',
              type: 'text',
              required: true,
              
            },
            {
              name: 'registered',
              type: 'date',
              
            },
            {
              name: 'lastUpdated',
              type: 'date',
              
            },
            {
              name: 'attributes',
              type: 'group',
              fields: [
                {
                  name: 'public',
                  type: 'checkbox',
                  defaultValue: true
                },
                {
                  name: 'archived',
                  type: 'checkbox'
                },
                {
                  name: 'spam',
                  type: 'checkbox'
                },
                {
                  name: 'deleted',
                  type: 'checkbox'
                },
                {
                  name: 'mature',
                  type: 'checkbox'
                }
              ]
            }
          ]
        },
        {
          label: 'Users',
          fields: [
            {
              name: 'tenantUsers',
              type: 'array',
              
              fields: [
                
                {
                  name: 'user',
                  type: 'relationship',
                  relationTo: 'users',
                  required: true,
                  admin: {
                    components: {
                      Field: '@/components/addExistingUser#ExistingUserSelect'
                    }
                    
                    
                  },
                  
                },
                {
                  name: 'role',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'User', value: 'user' },
                    { label: 'Super-Admin', value: 'super-admin' },
                  ]
                }
              ],
              admin: {
                description: 'Add an existing user by username and assign a role'
              },
             
            },

            {
              name: 'addNewUser',
              type: 'array',
              label: 'Add New User',
              fields: [
                {
                  name: 'newUsername',
                  type: 'text',
                  label: 'Username',
                },
                {
                  name: 'newEmail',
                  type: 'email',
                  label: 'Email',
                  
                },
                {
                  name: 'newPassword',
                  type: 'text',
                  label: 'Password',
                },
                {
                  name: 'newRole',
                  type: 'select',
                  label: 'Role',
                 
                  options: [
                    { label: 'Super-Admin', value: 'super-admin' },
                    { label: 'User', value: 'user' },
                  ]
                }
              ],
              admin: {
                description: 'Add a new user and assign a role'
              }
            }
            
          ],
        },
        // {
        //   label: 'Themes',
        //   fields: [
        //     {
        //       name: 'activeTheme',
        //       type: 'relationship',
        //       relationTo: 'themes'
        //     }
        //   ]
        // },

        {
          label: 'Settings',
          fields: [
            {
              name: 'generalSettings',
              type: 'group',
              fields: [
                {
                  name: 'siteName',
                  type: 'text'
                },
                {
                  name: 'siteDescription',
                  type: 'textarea'
                },
                {
                  name: 'language',
                  type: 'select',
                  defaultValue: 'en-us',
                  options: [
                    { label: 'English (US)', value: 'en-us' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],

  hooks: {
    
   
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create' || operation === 'update') {
          const { addNewUser, tenant, siteId } = data;
  
          if (addNewUser && addNewUser.length > 0) {
            for (const newUserData of addNewUser) {
              const { newUsername, newEmail, newPassword, newRole } = newUserData;
  
              if (newEmail) {
                const existingUser = await req.payload.find({
                  collection: 'users',
                  where: { email: { equals: newEmail } },
                });
  
                if (existingUser.totalDocs === 0) {
                  console.log('Creating new user');
                  try {
                    const createdUser = await req.payload.create({
                      collection: 'users',
                      data: {
                        username: newUsername,
                        email: newEmail,
                        password: newPassword,
                        roles: ['user'], // Default role
                        tenants: [{
                          tenant: tenant,
                          roles: [newRole === 'super-admin' ? 'tenant-admin' : 'tenant-viewer'],
                        }],
                      }
                    });
  
                    // Add the new user to the tenantUsers array
                    if (!data.tenantUsers) {
                      data.tenantUsers = [];
                    }
                    data.tenantUsers.push({
                      user: createdUser.id,
                      role: newRole,
                    });
  
                    // Update the users count in the corresponding site
                    if (siteId) {
                      const site = await req.payload.findByID({
                        collection: 'sites',
                        id: siteId,
                      });
                      if (site) {
                        await req.payload.update({
                          collection: 'sites',
                          id: siteId,
                          data: {
                            users: (site.users || 0) + 1,
                          },
                        });
                      }
                    }
                  } catch (error) {
                    console.error('Error creating user:', error);
                    throw error;
                  }
                }
              }
            }
          }
  
          // Clear the addNewUser array after processing
          data.addNewUser = [];
        }
        return data;
      }
    ]
  }
}

export default SiteSettings;
