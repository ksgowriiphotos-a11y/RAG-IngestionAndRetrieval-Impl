import type { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';
import MistralClient from '@mistralai/mistralai';

const connectToMongo = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not defined');

    const client = new MongoClient(uri);

    await client.connect();
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

type StoryInput = {
  content: string;
  metadata?: Record<string, any>;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Only POST allowed' });
  }

  let mongoClient: MongoClient | null = null;

  try {
    const mistral = new MistralClient(process.env.MISTRAL_API_KEY || '');
    
    // Connect to MongoDB
    mongoClient = await connectToMongo();
    const db = mongoClient.db('rag_userstories');
    const collection = db.collection('stories');

    // Accept body.stories as array or single story
    const body = req.body || {};
    let stories: StoryInput[] = [];

    if (Array.isArray(body.stories) && body.stories.length > 0) {
      stories = body.stories;
    } else if (body.story) {
      stories = [body.story];
    } else {
      // Default sample stories if none provided
      stories = [
        {
          content: 'As a user, I want to reset my password so that I can regain access to my account.',
          metadata: {
            description: 'Password reset functionality via email verification',
            acceptanceCriteria: [
              'User can request password reset via email',
              'Reset link is sent to registered email',
              'Link expires after 24 hours'
            ],
            epic: 'User Authentication',
            sprint: 'Sprint 2',
            points: 5,
            priority: 'high',
            status: 'completed',
            assignee: 'John Doe',
            createdDate: new Date().toISOString()
          }
        },
        {
          content: 'As a developer, I want centralized error logging so that I can track and triage issues quickly.',
          metadata: {
            description: 'Centralized error logging implementation',
            acceptanceCriteria: ['All errors captured with stack trace', 'Timestamp included', 'Severity levels defined'],
            epic: 'Observability',
            sprint: 'Sprint 3',
            points: 8,
            priority: 'medium',
            status: 'in-progress',
            assignee: 'Jane Smith',
            createdDate: new Date().toISOString()
          }
        }
      ];
    }

    const results: Array<{ upsertedId?: any; matchedCount?: number; content: string }> = [];

    for (const s of stories) {
      // Create embedding for each story content
      let embedding: number[] | null = null;
      try {
        const resp = await mistral.embeddings({ model: 'mistral-embed', input: s.content });
        embedding = resp?.data?.[0]?.embedding ?? null;
      } catch (err) {
        console.warn('Embedding generation failed:', err);
        embedding = null;
      }

      // Upsert story by content
      const filter = { content: s.content };
      const update = {
        $set: {
          content: s.content,
          metadata: s.metadata || {},
          embedding: embedding
        }
      };

      const op = await collection.updateOne(filter, update, { upsert: true });
      results.push({ upsertedId: op.upsertedId, matchedCount: op.matchedCount, content: s.content });
    }

    return res.status(200).json({ ok: true, count: results.length, results });
  } catch (error: any) {
    console.error('Ingest error:', error);
    return res.status(500).json({ 
      ok: false, 
      message: error?.message ?? String(error),
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  } finally {
    // Close MongoDB connection
    if (mongoClient) {
      try {
        await mongoClient.close();
        console.log('MongoDB connection closed');
      } catch (closeError) {
        console.error('Error closing MongoDB connection:', closeError);
      }
    }
  }
}
