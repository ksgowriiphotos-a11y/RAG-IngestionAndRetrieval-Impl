import { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '@/lib/mongodb';
import { RAGConfig, RAGPipelineResponse, RankedStory } from '@/types';
import { MongoClient } from 'mongodb';
import MistralClient from '@mistralai/mistralai';

const DEFAULT_CONFIG: RAGConfig = {
    vectorWeight: 0.7,
    bm25Weight: 0.3,
    topK: 5
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<RAGPipelineResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            normalized_new_story: '',
            refined_story: null,
            story_quality_score: 0,
            ranked_related_stories: [],
            errors: [{ code: 'METHOD_NOT_ALLOWED', message: 'Only POST requests are allowed' }]
        });
    }

    try {
        const { story, config = DEFAULT_CONFIG } = req.body;
        
        if (!story) {
            return res.status(400).json({
                normalized_new_story: '',
                refined_story: null,
                story_quality_score: 0,
                ranked_related_stories: [],
                errors: [{ code: 'MISSING_STORY', message: 'Story content is required' }]
            });
        }

        // Normalize weights
        const totalWeight = config.vectorWeight + config.bm25Weight;
        const normalizedConfig = {
            ...config,
            vectorWeight: config.vectorWeight / totalWeight,
            bm25Weight: config.bm25Weight / totalWeight
        };

    // Initialize Mistral client
    const mistral = new MistralClient(process.env.MISTRAL_API_KEY || '');

        // Create embeddings using Mistral's embedding model
        const embeddings = {
            embedQuery: async (text: string): Promise<number[]> => {
                try {
                    const response = await mistral.embeddings({
                        model: "mistral-embed",
                        input: text
                    });
                    return response.data[0].embedding;
                } catch (error) {
                    console.error('Error getting embeddings:', error);
                    throw error;
                }
            },
            embedDocuments: async (documents: string[]): Promise<number[][]> => {
                try {
                    const response = await mistral.embeddings({
                        model: "mistral-embed",
                        input: documents
                    });
                    return response.data.map((d: { embedding: number[] }) => d.embedding);
                } catch (error) {
                    console.error('Error getting embeddings:', error);
                    throw error;
                }
            }
        };

        // Generate embedding for the new story
        const normalizedStory = normalizeStory(story);
        const storyEmbedding = await embeddings.embedQuery(normalizedStory);

        // Connect to MongoDB
        const client = await clientPromise;
        const db = client.db('rag_userstories');
        const collection = db.collection('stories');

        // Perform hybrid search
        const relatedStories = await performHybridSearch(
            collection,
            storyEmbedding,
            normalizedStory,
            normalizedConfig
        );

        // Calculate story quality score
        const qualityScore = calculateStoryQuality(normalizedStory);

        // Refine the story using LangChain
        const refinedStory = await refineStory(normalizedStory);

        return res.status(200).json({
            normalized_new_story: normalizedStory,
            refined_story: refinedStory,
            story_quality_score: qualityScore,
            ranked_related_stories: relatedStories,
            errors: []
        });

    } catch (error: any) {
        console.error('RAG Pipeline Error:', error);
        return res.status(500).json({
            normalized_new_story: '',
            refined_story: null,
            story_quality_score: 0,
            ranked_related_stories: [],
            errors: [{
                code: 'INTERNAL_ERROR',
                message: error.message,
                details: { stack: error.stack }
            }]
        });
    }
}

function normalizeStory(story: string): string {
    // Remove extra whitespace and normalize line endings
    let normalized = story
        .trim()
        .replace(/\r\n/g, '\n')
        .replace(/\s+/g, ' ');

    // Check if the story already follows the "As a... I want... so that..." format
    if (!/^as a .+? i want .+? so that .+?$/i.test(normalized)) {
        // Try to extract role, action, and value from unstructured text
        const roleMatch = normalized.match(/(?:as (?:an?|the)|for(?: the)?|from(?: the)?) ([^,.]+)/i);
        const actionMatch = normalized.match(/(?:want|need|would like|should be able) to ([^,.]+)/i);
        const valueMatch = normalized.match(/(?:so that|in order to|to be able to) ([^,.]+)/i);

        const role = roleMatch ? roleMatch[1].trim() : 'user';
        const action = actionMatch ? actionMatch[1].trim() : normalized;
        const value = valueMatch ? valueMatch[1].trim() : 'achieve the desired outcome';

        // Reconstruct in standard format
        normalized = `As a ${role}, I want to ${action} so that ${value}`;
    }

    // Normalize case - capitalize first letter, rest lowercase
    normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();

    // Ensure proper punctuation
    if (!/[.!?]$/.test(normalized)) {
        normalized += '.';
    }

    return normalized;
}

async function performHybridSearch(
    collection: any,
    embedding: number[],
    text: string,
    config: RAGConfig
): Promise<RankedStory[]> {
        // First, check if we have any documents at all
        const count = await collection.countDocuments();
        if (count === 0) {
            console.log('No documents found in the collection');
            // Return a dummy story to show the structure is working
            return [{
                _id: '1',
                content: 'Example story - No actual stories in database',
                metadata: {
                    description: 'This is a placeholder because no stories exist in the database.',
                    acceptanceCriteria: ['Add some user stories to the database to see real results'],
                    priority: 'high',
                    status: 'not-started'
                },
                vector_score: 0,
                vector_score_norm: 0,
                bm25_score: 0,
                bm25_score_norm: 0,
                hybrid_score: 0
            }];
        }

        // Get all documents to find the most similar ones
        const documents = await collection.find({}).toArray();
        console.log(`Found ${documents.length} documents in collection`);

    // Attempt both searches; if the vector (knn) search is not supported for the index,
    // fall back to computing vector similarity client-side using stored embeddings.
    let knnResults: any[] = [];
    let textResults: any[] = [];

    try {
        // Compute similarities locally using the documents fetched earlier
        knnResults = [];
        textResults = [];

        // Process each document
        for (const doc of documents) {
            console.log('Processing document:', doc); // Debug log

            if (!doc || !doc.content) {
                console.warn('Invalid document structure:', doc);
                continue;
            }

            try {
                // Compute vector similarity if embeddings exist
                if (doc.embedding && Array.isArray(doc.embedding)) {
                    const vectorScore = computeCosineSimilarity(embedding, doc.embedding);
                    knnResults.push({
                        ...doc,
                        vector_score: vectorScore
                    });
                }
                
                // Compute text similarity
                const textScore = computeTextSimilarity(
                    text?.toLowerCase() || '',
                    doc.content?.toLowerCase() || ''
                );
                textResults.push({
                    ...doc,
                    bm25_score: textScore
                });
            } catch (docErr) {
                console.error('Error processing document:', docErr, doc);
                continue;
            }
        }

        if (knnResults.length === 0 && textResults.length === 0) {
            console.warn('No valid results found in database');
        }
    } catch (err: any) {
        console.error('Search failed:', err);
        knnResults = [];
        textResults = [];
    }

    // If knn search wasn't available, compute vector similarity locally using stored embeddings
    if (!knnResults || knnResults.length === 0) {
        // Ensure we have embeddings on candidate docs (from textResults)
        const candidatesWithEmbedding = textResults.filter((d: any) => Array.isArray(d.embedding) && d.embedding.length > 0);

        const cosine = (a: number[], b: number[]) => {
            if (!a || !b || a.length !== b.length) return 0;
            let dot = 0, na = 0, nb = 0;
            for (let i = 0; i < a.length; i++) {
                dot += a[i] * b[i];
                na += a[i] * a[i];
                nb += b[i] * b[i];
            }
            if (na === 0 || nb === 0) return 0;
            return dot / (Math.sqrt(na) * Math.sqrt(nb));
        };

        knnResults = candidatesWithEmbedding.map((d: any) => ({
            _id: d._id,
            content: d.content,
            metadata: d.metadata,
            vector_score: cosine(embedding, d.embedding)
        }));
    }

    // Merge results by document _id
    const mergedMap = new Map<string, any>();

    const addToMap = (doc: any, scoreField: string) => {
        const id = doc._id?.toString?.() ?? JSON.stringify(doc);
        const existing = mergedMap.get(id) || { 
            _id: doc._id, 
            content: doc.content, 
            metadata: doc.metadata,
            vector_score: 0,
            bm25_score: 0,
            vector_score_norm: 0,
            bm25_score_norm: 0,
            hybrid_score: 0
        };
        existing[scoreField] = doc[scoreField] ?? 0;
        mergedMap.set(id, existing);
    };

    knnResults.forEach((d: any) => addToMap(d, 'vector_score'));
    textResults.forEach((d: any) => addToMap(d, 'bm25_score'));

    const merged = Array.from(mergedMap.values());

    if (merged.length === 0) return [];

    const vectorScores = merged.map((r: any) => r.vector_score ?? 0);
    const bm25Scores = merged.map((r: any) => r.bm25_score ?? 0);

    const minVectorScore = Math.min(...vectorScores);
    const maxVectorScore = Math.max(...vectorScores);
    const minBM25Score = Math.min(...bm25Scores);
    const maxBM25Score = Math.max(...bm25Scores);

    const normalizedResults = merged.map((result: any) => {
        const vectorScore = result.vector_score ?? 0;
        const bm25Score = result.bm25_score ?? 0;

        const vectorScoreNorm = normalizeScore(vectorScore, minVectorScore, maxVectorScore);
        const bm25ScoreNorm = normalizeScore(bm25Score, minBM25Score, maxBM25Score);

        return {
            ...result,
            vector_score_norm: vectorScoreNorm,
            bm25_score_norm: bm25ScoreNorm,
            hybrid_score: (vectorScoreNorm * config.vectorWeight) + (bm25ScoreNorm * config.bm25Weight)
        };
    });

    const deduplicated = normalizedResults
        .sort((a: { hybrid_score: number }, b: { hybrid_score: number }) => b.hybrid_score - a.hybrid_score)
        // _id may be an ObjectId; use toString for stable comparison
        .filter((story: { _id: { toString: () => string } }, index: number, self: any[]) =>
            index === self.findIndex((s: { _id: { toString: () => string } }) => s._id.toString() === story._id.toString())
        );

    return deduplicated.slice(0, config.topK);
}

function normalizeScore(score: number, min: number, max: number): number {
    if (max === min) return 1;
    return (score - min) / (max - min);
}

function computeCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < vec1.length; i++) {
        dot += vec1[i] * vec2[i];
        na += vec1[i] * vec1[i];
        nb += vec2[i] * vec2[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function computeTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
}

function calculateStoryQuality(story: string): number {
    let score = 0;
    
    // Check for "As a... I want... so that..." format
    if (/As a .+ I want .+ so that .+/i.test(story)) {
        score += 40;
    }

    // Check for acceptance criteria
    if (/acceptance criteria:/i.test(story)) {
        score += 30;
    }

    // Check for numbered or bulleted criteria
    if (/(\d+\)|\*|\-)\s+.+/.test(story)) {
        score += 20;
    }

    // Check minimum length
    if (story.length > 50) {
        score += 10;
    }

    return Math.min(100, score);
}

async function refineStory(story: string): Promise<string | null> {
    try {
        const mistral = new MistralClient(process.env.MISTRAL_API_KEY || '');
        
        const prompt = `Analyze and improve the following user story. Ensure it:
1. Follows the format "As a <role>, I want <action> so that <value>"
2. Is specific and measurable
3. Has clear acceptance criteria
4. Uses active voice
5. Is focused on user value

User Story: "${story}"

Provide the improved version in the following format:
STORY: <improved user story>
ACCEPTANCE_CRITERIA:
- <criterion 1>
- <criterion 2>
- <criterion 3>
`;

        const response = await mistral.chat({
            model: "mistral-tiny",
            messages: [{
                role: "user",
                content: prompt
            }]
        });

        const content = response.choices[0]?.message?.content;
        if (!content) return story;

        // Extract the improved story and acceptance criteria
        const storyMatch = content.match(/STORY:\s*(.+?)(?=ACCEPTANCE_CRITERIA:|$)/s);
        const criteriaMatch = content.match(/ACCEPTANCE_CRITERIA:\s*((?:-.+\n?)+)/s);

        let refined = storyMatch ? storyMatch[1].trim() : story;
        const criteria = criteriaMatch ? criteriaMatch[1].trim() : '';

        // Append acceptance criteria if available
        if (criteria) {
            refined += '\n\nAcceptance Criteria:\n' + criteria;
        }

        return refined;
    } catch (error) {
        console.error('Story refinement error:', error);
        // Fallback to original story if refinement fails
        return story;
    }
}