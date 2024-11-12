import { MongoMemoryReplSet } from 'mongodb-memory-server'
// eslint-disable-next-line no-restricted-exports
export default async () => {
  console.log('Starting memory db...')

  // @ts-expect-error
  process.env.NODE_ENV = 'test'
  process.env.PAYLOAD_DROP_DATABASE = 'true'
  process.env.NODE_OPTIONS = '--no-deprecation'
  process.env.DISABLE_PAYLOAD_HMR = 'true'

  if (!process.env.PAYLOAD_DATABASE || process.env.PAYLOAD_DATABASE === 'mongodb') {
    if (global._mongoMemoryServer) {
      console.log('Stopping memorydb...')
      await global._mongoMemoryServer.stop()
      console.log('Stopped memorydb')
    }

    if (global._payload?.payload?.db?.mongoose?.models) {
      const mongoose = global._payload?.payload?.db?.mongoose
      Object.keys(mongoose.models).map((model) => mongoose.deleteModel(model))
    }

    const db = await MongoMemoryReplSet.create({
      replSet: {
        count: 3,
        dbName: 'payloadmemory',
      },
    })

    global._mongoMemoryServer = db

    process.env.MONGODB_MEMORY_SERVER_URI = `${global._mongoMemoryServer.getUri()}&retryWrites=true`
  }
}
