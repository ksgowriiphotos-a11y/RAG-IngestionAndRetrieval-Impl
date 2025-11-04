import { MongoClient } from 'mongodb';

if (!process.env.MONGODB_URI) {
    throw new Error('Please add your MongoDB URI to .env.local');
}

const uri = process.env.MONGODB_URI;
const options = {
    serverApi: {
        version: '1' as const,
        strict: true,
        deprecationErrors: true
    },
    maxPoolSize: 10,
    minPoolSize: 5,
    maxIdleTimeMS: 120000,
    connectTimeoutMS: 10000,
};

export async function connectToMongoDB() {
    try {
        const client = new MongoClient(uri, options);
        await client.connect();
        console.log('Connected to MongoDB');
        return client;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}