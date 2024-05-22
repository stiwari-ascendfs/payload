'use client'
import type { PaginatedDocs, TypeWithVersion } from 'payload/database'
import type { Data, FormState, TypeWithTimestamps } from 'payload/types'
import type { DocumentPermissions, DocumentPreferences, TypeWithID, Where } from 'payload/types'

import { notFound } from 'next/navigation.js'
import qs from 'qs'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

import type { DocumentInfoContext, DocumentInfoProps } from './types.js'

import { LoadingOverlay } from '../../elements/Loading/index.js'
import { formatDocTitle } from '../../utilities/formatDocTitle.js'
import { getFormState } from '../../utilities/getFormState.js'
import { hasSavePermission as getHasSavePermission } from '../../utilities/hasSavePermission.js'
import { isEditing as getIsEditing } from '../../utilities/isEditing.js'
import { reduceFieldsToValues } from '../../utilities/reduceFieldsToValues.js'
import { useAuth } from '../Auth/index.js'
import { useConfig } from '../Config/index.js'
import { useLocale } from '../Locale/index.js'
import { usePreferences } from '../Preferences/index.js'
import { useTranslation } from '../Translation/index.js'

const Context = createContext({} as DocumentInfoContext)

export type * from './types.js'

export const useDocumentInfo = (): DocumentInfoContext => useContext(Context)

export const DocumentInfoProvider: React.FC<
  DocumentInfoProps & {
    children: React.ReactNode
  }
> = ({ children, ...props }) => {
  const {
    id,
    collectionSlug,
    docPermissions: docPermissionsFromProps,
    globalSlug,
    hasPublishPermission: hasPublishPermissionFromProps,
    hasSavePermission: hasSavePermissionFromProps,
    onLoadError,
    onSave: onSaveFromProps,
  } = props

  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [documentTitle, setDocumentTitle] = useState('')
  const [data, setData] = useState<Data>()
  const [initialState, setInitialState] = useState<FormState>()
  const [publishedDoc, setPublishedDoc] = useState<TypeWithID & TypeWithTimestamps>(null)
  const [versions, setVersions] = useState<PaginatedDocs<TypeWithVersion<any>>>(null)
  const [docPermissions, setDocPermissions] = useState<DocumentPermissions>(null)
  const [hasSavePermission, setHasSavePermission] = useState<boolean>(null)
  const [hasPublishPermission, setHasPublishPermission] = useState<boolean>(null)
  const hasInitializedDocPermissions = useRef(false)
  const [unpublishedVersions, setUnpublishedVersions] =
    useState<PaginatedDocs<TypeWithVersion<any>>>(null)

  const { getPreference, setPreference } = usePreferences()
  const { i18n } = useTranslation()
  const { permissions } = useAuth()
  const { code: locale } = useLocale()

  const {
    admin: { dateFormat },
    collections,
    globals,
    routes: { api },
    serverURL,
  } = useConfig()

  const collectionConfig = collections.find((c) => c.slug === collectionSlug)
  const globalConfig = globals.find((g) => g.slug === globalSlug)
  const docConfig = collectionConfig || globalConfig
  const versionsConfig = docConfig?.versions

  const baseURL = `${serverURL}${api}`
  let slug: string
  let preferencesKey: string

  if (globalSlug) {
    slug = globalSlug
    preferencesKey = `global-${slug}`
  }

  if (collectionSlug) {
    slug = collectionSlug

    if (id) {
      preferencesKey = `collection-${slug}-${id}`
    }
  }

  const isEditing = getIsEditing({ id, collectionSlug, globalSlug })
  const operation = isEditing ? 'update' : 'create'
  const shouldFetchVersions = Boolean(versionsConfig && docPermissions?.readVersions?.permission)

  const getVersions = useCallback(async () => {
    let versionFetchURL
    let publishedFetchURL
    let unpublishedVersionJSON = null
    let versionJSON = null
    let shouldFetch = true

    const versionParams = {
      depth: 0,
      where: {
        and: [],
      },
    }

    const publishedVersionParams: { depth: number; locale: string; where: Where } = {
      depth: 0,
      locale: locale || undefined,
      where: {
        and: [
          {
            or: [
              {
                _status: {
                  equals: 'published',
                },
              },
              {
                _status: {
                  exists: false,
                },
              },
            ],
          },
        ],
      },
    }

    if (globalSlug) {
      versionFetchURL = `${baseURL}/globals/${globalSlug}/versions`
      publishedFetchURL = `${baseURL}/globals/${globalSlug}?${qs.stringify(publishedVersionParams)}`
    }

    if (collectionSlug) {
      versionFetchURL = `${baseURL}/${collectionSlug}/versions`

      publishedVersionParams.where.and.push({
        id: {
          equals: id,
        },
      })

      publishedFetchURL = `${baseURL}/${collectionSlug}?${qs.stringify(publishedVersionParams)}`

      if (!id) {
        shouldFetch = false
      }

      versionParams.where.and.push({
        parent: {
          equals: id,
        },
      })
    }

    if (shouldFetch) {
      let publishedJSON

      if (versionsConfig?.drafts) {
        publishedJSON = await fetch(publishedFetchURL, {
          credentials: 'include',
          headers: {
            'Accept-Language': i18n.language,
          },
        }).then((res) => res.json())

        if (collectionSlug) {
          publishedJSON = publishedJSON?.docs?.[0]
        }
      }

      if (shouldFetchVersions) {
        versionJSON = await fetch(`${versionFetchURL}?${qs.stringify(versionParams)}`, {
          credentials: 'include',
          headers: {
            'Accept-Language': i18n.language,
          },
        }).then((res) => res.json())

        if (publishedJSON?.updatedAt) {
          const newerVersionParams = {
            ...versionParams,
            where: {
              ...versionParams.where,
              and: [
                ...versionParams.where.and,
                {
                  updatedAt: {
                    greater_than: publishedJSON?.updatedAt,
                  },
                },
              ],
            },
          }

          // Get any newer versions available
          const newerVersionRes = await fetch(
            `${versionFetchURL}?${qs.stringify(newerVersionParams)}`,
            {
              credentials: 'include',
              headers: {
                'Accept-Language': i18n.language,
              },
            },
          )

          if (newerVersionRes.status === 200) {
            unpublishedVersionJSON = await newerVersionRes.json()
          }
        }
      }

      setPublishedDoc(publishedJSON)
      setVersions(versionJSON)
      setUnpublishedVersions(unpublishedVersionJSON)
    }
  }, [i18n, globalSlug, collectionSlug, id, baseURL, locale, versionsConfig, shouldFetchVersions])

  const getDocPermissions = React.useCallback(
    async (data: Data) => {
      const params = {
        locale: locale || undefined,
      }

      const newIsEditing = getIsEditing({ id: data?.id, collectionSlug, globalSlug })

      if (newIsEditing) {
        const docAccessURL = collectionSlug
          ? `/${collectionSlug}/access/${data.id}`
          : globalSlug
            ? `/globals/${globalSlug}/access`
            : null

        if (docAccessURL) {
          const res = await fetch(`${serverURL}${api}${docAccessURL}?${qs.stringify(params)}`, {
            credentials: 'include',
            headers: {
              'Accept-Language': i18n.language,
            },
          })

          const json: DocumentPermissions = await res.json()
          const publishedAccessJSON = await fetch(
            `${serverURL}${api}${docAccessURL}?${qs.stringify(params)}`,
            {
              body: JSON.stringify({
                data: {
                  ...(data || {}),
                  _status: 'published',
                },
              }),
              credentials: 'include',
              headers: {
                'Accept-Language': i18n.language,
              },
              method: 'POST',
            },
          ).then((res) => res.json())

          setDocPermissions(json)

          setHasSavePermission(
            getHasSavePermission({
              collectionSlug,
              docPermissions: json,
              globalSlug,
              isEditing: newIsEditing,
            }),
          )

          setHasPublishPermission(publishedAccessJSON?.update?.permission)
        }
      } else {
        // when creating new documents, there is no permissions saved for this document yet
        // use the generic entity permissions instead
        const newDocPermissions = collectionSlug
          ? permissions?.collections?.[collectionSlug]
          : permissions?.globals?.[globalSlug]

        setDocPermissions(newDocPermissions)

        setHasSavePermission(
          getHasSavePermission({
            collectionSlug,
            docPermissions: newDocPermissions,
            globalSlug,
            isEditing: newIsEditing,
          }),
        )
      }
    },
    [serverURL, api, permissions, i18n.language, locale, collectionSlug, globalSlug, isEditing],
  )

  const getDocPreferences = useCallback(() => {
    return getPreference<DocumentPreferences>(preferencesKey)
  }, [getPreference, preferencesKey])

  const setDocFieldPreferences = useCallback<DocumentInfoContext['setDocFieldPreferences']>(
    async (path, fieldPreferences) => {
      const allPreferences = await getDocPreferences()

      if (preferencesKey) {
        try {
          await setPreference(preferencesKey, {
            ...allPreferences,
            fields: {
              ...(allPreferences?.fields || {}),
              [path]: {
                ...allPreferences?.fields?.[path],
                ...fieldPreferences,
              },
            },
          })
        } catch (e) {
          console.error(e) // eslint-disable-line no-console
        }
      }
    },
    [setPreference, preferencesKey, getDocPreferences],
  )

  const onSave = React.useCallback<DocumentInfoContext['onSave']>(
    async (json) => {
      if (typeof onSaveFromProps === 'function') {
        void onSaveFromProps(json)
      }

      const docPreferences = await getDocPreferences()

      const newState = await getFormState({
        apiRoute: api,
        body: {
          id,
          collectionSlug,
          data: json.doc,
          docPreferences,
          globalSlug,
          locale,
          operation,
          schemaPath: collectionSlug || globalSlug,
        },
        serverURL,
      })

      const newData = json.doc

      setInitialState(newState)
      setData(newData)
      await getDocPermissions(newData)
    },
    [
      api,
      collectionSlug,
      getDocPreferences,
      globalSlug,
      id,
      operation,
      locale,
      onSaveFromProps,
      serverURL,
      getDocPermissions,
    ],
  )

  useEffect(() => {
    const abortController = new AbortController()

    const getInitialState = async () => {
      setIsError(false)
      setIsLoading(true)

      try {
        const result = await getFormState({
          apiRoute: api,
          body: {
            id,
            collectionSlug,
            globalSlug,
            locale,
            operation,
            schemaPath: collectionSlug || globalSlug,
          },
          onError: onLoadError,
          serverURL,
          signal: abortController.signal,
        })

        setData(reduceFieldsToValues(result, true))
        setInitialState(result)
      } catch (err) {
        if (!abortController.signal.aborted) {
          if (typeof onLoadError === 'function') {
            void onLoadError()
          }
          setIsError(true)
          setIsLoading(false)
        }
      }

      setIsLoading(false)
    }

    void getInitialState()

    return () => {
      abortController.abort()
    }
  }, [
    api,
    operation,
    collectionSlug,
    serverURL,
    id,
    getPreference,
    globalSlug,
    locale,
    onLoadError,
  ])

  useEffect(() => {
    void getVersions()
  }, [getVersions])

  useEffect(() => {
    setDocumentTitle(
      formatDocTitle({
        collectionConfig,
        data: { ...data, id },
        dateFormat,
        fallback: id?.toString(),
        globalConfig,
        i18n,
      }),
    )
  }, [collectionConfig, data, dateFormat, i18n, id, globalConfig])

  useEffect(() => {
    const loadDocPermissions = async () => {
      const docPermissions: DocumentPermissions = docPermissionsFromProps
      const hasSavePermission: boolean = hasSavePermissionFromProps
      const hasPublishPermission: boolean = hasPublishPermissionFromProps

      if (
        !docPermissions ||
        hasSavePermission === undefined ||
        hasSavePermission === null ||
        hasPublishPermission === undefined ||
        hasPublishPermission === null
      ) {
        await getDocPermissions(data)
      } else {
        setDocPermissions(docPermissions)
        setHasSavePermission(hasSavePermission)
        setHasPublishPermission(hasPublishPermission)
      }
    }

    if (!hasInitializedDocPermissions.current && data && (collectionSlug || globalSlug)) {
      hasInitializedDocPermissions.current = true
      void loadDocPermissions()
    }
  }, [
    getDocPermissions,
    docPermissionsFromProps,
    hasSavePermissionFromProps,
    hasPublishPermissionFromProps,
    setDocPermissions,
    collectionSlug,
    globalSlug,
    data,
  ])

  if (isError) notFound()

  if (!initialState || isLoading) {
    return <LoadingOverlay />
  }

  const value: DocumentInfoContext = {
    ...props,
    docConfig,
    docPermissions,
    getDocPermissions,
    getDocPreferences,
    getVersions,
    hasPublishPermission,
    hasSavePermission,
    initialData: data,
    initialState,
    onSave,
    publishedDoc,
    setDocFieldPreferences,
    setDocumentTitle,
    title: documentTitle,
    unpublishedVersions,
    versions,
  }

  return <Context.Provider value={value}>{children}</Context.Provider>
}
