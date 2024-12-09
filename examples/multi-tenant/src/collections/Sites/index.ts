import type { CollectionConfig } from "payload";
import { ensureUniqueSlug } from './hooks/ensureUniqueSlug'
import { tenantField } from '../../fields/TenantField'
import { baseListFilter } from './access/baseListFilter'
import { canMutatePage } from './access/byTenant'
import { readAccess } from './access/readAccess'
import StatusCell from '@/components/sitesTable'



export const Sites: CollectionConfig = {
    slug: 'sites',
    access: {
        
        create: canMutatePage,
        delete: canMutatePage,
        read: readAccess,
        update: canMutatePage,
    },
    admin: {
        useAsTitle: 'url',
        baseListFilter,
        defaultColumns: ['url', 'lastUpdated', 'registered', 'users'],
    
        
    },
    fields: [
        {
            name: 'url',
            type: 'text',
            required: true,
            label: 'Site Address (URL)',
            admin: {
                placeholder:'sitegenerator.dev.playascend.com/',
                description: 'Only lowercase letters (a-z), numbers, and hyphens are allowed.'

            },
            hooks: {
                beforeValidate: [ensureUniqueSlug],
            },
            index: true
        },

        {
            name: 'status',
            type: 'select',
            options: ['active', 'pending', 'inactive'],
            admin:{
                components:{
                    Cell: 
                }
            }
        },
        {
            name: 'title',
            type: 'text',
            required: true,
            label: 'Site Title'
        },
        {
            name: 'language',
            type: 'select',
            label: 'Site Language',
            defaultValue: 'en-us',
            options: [
                {
                    label: 'English (United States)',
                    value: 'en-us'

                }
            ]
        },

        {
            name: 'adminEmail',
            type: 'email',
            required: true,
            admin: {
                description: 'A new user will be created if the above email address is not in the database. The username and a link to set the password will be mailed to this email address.'

            }

        },

        {
            name: 'isMain',
            type: 'checkbox',
            label: 'Main Site'
        },

        {
            name: 'lastUpdated',
            type: 'date',
            admin: {
                readOnly: true
            }
        },

        {
            name: 'registered',
            type: 'date',
            admin: {
                readOnly: true
            }
        },

        {
            name: 'users',
            type: 'number',
            defaultValue: 0,
            admin: {
                readOnly: true
            }
        },

        {
            name: 'settings',
            type: 'relationship',
            relationTo: 'site-settings',
            hasMany: false,
            admin: {
                components: {
                    Field: '@/components/sitesettings#SettingsButton'
                },
                position: 'sidebar',

            },
            
        },
        

       
        tenantField,



    ],

    hooks: {
        beforeChange: [
            ({ data }) => {
                return  {
                    ...data,
                    lastUpdated: new Date()
                }
            } 
        ],

        afterChange: [
            async ({ doc, req, operation, previousDoc}) => {
                const payload = req.payload;

   
                if (operation === 'create') {
                    try{
                    const settings = await payload.create({
                        collection: 'site-settings',
                        data: {
                            siteId: doc.id,
                            url: doc.url,
                            registered: doc.createdAt,
                            lastUpdated: new Date().toISOString(),
                            tenant: doc.tenant,
                            attributes: {
                                public: true
                            }
                        }


                    });

                  

                    await payload.update({
                        collection: 'sites',
                        id: doc.id,
                        data: {
                            settings: settings.id
                        }
                });
            } catch (error) {
                console.error('Error creating site settings', error);
                throw new Error('Failed to create site settings');
            }

                }

                if (operation === 'update'){
                    if (doc.settings && previousDoc) {
                    if (doc.tenant !== previousDoc.tenant){
                        const settingsId = typeof doc.settings === 'object' ? doc.settings.id : doc.settings;
                        
                        try {
                            await payload.update({
                                collection: 'site-settings',
                                id: settingsId,
                                data:{
                                    tenant: doc.tenant
                                },
                            });
                        } catch (error) {
                            console.error('Error updating site settings', error);
                            throw new Error('Failed to update site settings');
                        }
                    }
                }else {
                    console.warn('Site Settings reference is missing or previous document is unavailable');
                }
                }    

            }
        ],

        afterDelete: [
            async ({req, id}) => {
                const payload = req.payload;

                const settings = await payload.find({
                    collection: 'site-settings',
                    where: {
                        siteId: { equals: id }
                    }

                });

                if (settings.docs.length > 0){
                    await payload.delete({
                        collection: 'site-settings',
                        id: settings.docs[0].id
                    })
                }
            }
        ],
    },

    timestamps: true
}

export default Sites;
