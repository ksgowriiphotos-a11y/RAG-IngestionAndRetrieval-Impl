import { NextRequest, NextResponse } from 'next/server';
import clientPromise from '@/src/backend/db/mongodb';
import { RAGConfig, RAGPipelineResponse } from '@/app/types';
import MistralClient from '@mistralai/mistralai';

const DEFAULT_CONFIG: RAGConfig = {
    vectorWeight: 0.6,
    bm25Weight: 0.3,
    hybridWeight: 0.1,
    topK: 6
};

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { story, config = DEFAULT_CONFIG } = body;
        
        if (!story) {
            return NextResponse.json({
                normalized_new_story: '',
                refined_story: null,
                story_quality_score: 0,
                ranked_related_stories: [],
                errors: [{ code: 'MISSING_STORY', message: 'Story content is required' }]
            }, { status: 400 });
        }

        // Normalize weights (vector, bm25, hybrid)
        const v = config.vectorWeight ?? DEFAULT_CONFIG.vectorWeight;
        const b = config.bm25Weight ?? DEFAULT_CONFIG.bm25Weight;
        const h = config.hybridWeight ?? DEFAULT_CONFIG.hybridWeight ?? 0;
        const totalWeight = v + b + h || 1;
        const normalizedConfig = {
            ...config,
            vectorWeight: v / totalWeight,
            bm25Weight: b / totalWeight,
            hybridWeight: h / totalWeight,
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

    const startAll = Date.now();
    // Generate embedding for the new story
    const normalizedStory = normalizeStory(story);
    const t1 = Date.now();
    const storyEmbedding = await embeddings.embedQuery(normalizedStory);
    const t2 = Date.now();

        // Connect to MongoDB
        const client = await clientPromise;
        const db = client.db('rag_userstories');
        const collection = db.collection('stories');

        // Perform hybrid search and LLM-scoring
        const searchStart = Date.now();
        const relatedStories = await performHybridSearch(
            collection,
            storyEmbedding,
            normalizedStory,
            normalizedConfig
        );
        const searchEnd = Date.now();

        // Enhance ranking with LLM scoring and RAG insights
        const llmStart = Date.now();
        const enhanced = await enhanceWithLLM(
            relatedStories,
            normalizedStory,
            mistral,
            normalizedConfig
        );
        const llmEnd = Date.now();

        // Calculate story quality score (detailed breakdown)
        const qualityStart = Date.now();
        const quality = await evaluateQualityDetailed(normalizedStory, mistral);
        const qualityEnd = Date.now();

        // Refine the story using LangChain
        const refineStart = Date.now();
        const refinedStory = await refineStory(normalizedStory);
        const refineEnd = Date.now();

        const endAll = Date.now();

        return NextResponse.json({
            normalized_new_story: normalizedStory,
            refined_story: refinedStory,
            story_quality_score: quality.totalScore, // 0-100
            quality_breakdown: quality.breakdown,
            recommendations: quality.recommendations,
            ranked_related_stories: enhanced.slice(0, config.topK || DEFAULT_CONFIG.topK),
            timings: {
                overall_ms: endAll - startAll,
                embedding_ms: t2 - t1,
                search_ms: searchEnd - searchStart,
                llm_scoring_ms: llmEnd - llmStart,
                refinement_ms: refineEnd - refineStart,
                quality_eval_ms: qualityEnd - qualityStart
            },
            errors: []
        });

    } catch (error: any) {
        console.error('RAG Pipeline Error:', error);
        return NextResponse.json({
            normalized_new_story: '',
            refined_story: null,
            story_quality_score: 0,
            ranked_related_stories: [],
            errors: [{
                code: 'INTERNAL_ERROR',
                message: error.message,
                details: { stack: error.stack }
            }]
        }, { status: 500 });
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
): Promise<any[]> {
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

    let knnResults: any[] = [];
    let textResults: any[] = [];

    try {
        // Process each document
        for (const doc of documents) {
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
    } catch (err: any) {
        console.error('Search failed:', err);
        knnResults = [];
        textResults = [];
    }

    // Merge results by document _id
    const mergedMap = new Map<string, any>();

    const addToMap = (doc: any, scoreField: string) => {
        const id = doc._id?.toString?.() ?? JSON.stringify(doc);
        const existing = mergedMap.get(id) || { 
            _id: doc._id, 
            content: doc.content, 
            key: doc.storyId,
            description: doc.description,
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

// Enhance each candidate using an LLM to produce a semantic similarity score and reasoning
async function enhanceWithLLM(candidates: any[], query: string, mistral: any, config: RAGConfig) {
    const enhanced: any[] = [];
    for (const c of candidates) {
        try {
            const snippet = (c.content || '').slice(0, 400);
            const prompt = `You are an assistant that scores how relevant a document excerpt is to a query user story.
Query: "${query}"
Excerpt: "${snippet}"

Give a numeric relevance score between 0 and 1 (higher is more relevant) and a one-sentence reasoning. Respond in JSON like: {"llm_score":0.82, "reason":"..."}`;

            const resp = await mistral.chat({
                model: 'mistral-tiny',
                messages: [{ role: 'user', content: prompt }]
            });

            const content = resp.choices?.[0]?.message?.content || '';
            let llmScore = 0;
            let reason = '';
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    llmScore = Number(parsed.llm_score) || 0;
                    reason = parsed.reason || '';
                } else {
                    // Try to extract number from text
                    const numMatch = content.match(/([0](?:\.[0-9]+)?|1(?:\.0+)?)/);
                    if (numMatch) llmScore = parseFloat(numMatch[1]);
                    reason = content.substring(0, 300);
                }
            } catch (e) {
                llmScore = 0;
                reason = content.substring(0, 300);
            }

            // Final hybrid score: combine normalized vector/bm25 with LLM score
            const vectorNorm = c.vector_score_norm ?? 0;
            const bm25Norm = c.bm25_score_norm ?? 0;
            const finalHybrid = (vectorNorm * config.vectorWeight) + (bm25Norm * config.bm25Weight) + ((config.hybridWeight ?? 0) * llmScore);

            enhanced.push({
                ...c,
                evidence: snippet,
                llm_score: llmScore,
                llm_reason: reason,
                hybrid_score_final: finalHybrid
            });
        } catch (err) {
            console.error('LLM enhancement failed for doc', c._id, err);
            enhanced.push({ ...c, llm_score: 0, llm_reason: 'LLM failed', hybrid_score_final: c.hybrid_score });
        }
    }

    // Sort by hybrid_score_final descending
    enhanced.sort((a, b) => (b.hybrid_score_final || 0) - (a.hybrid_score_final || 0));
    return enhanced;
}

// Evaluate quality with detailed rubrics; returns breakdown (0-10) and recommendations
async function evaluateQualityDetailed(story: string, mistral: any) {
    // Build prompt with explicit structure requirements
    const prompt = `Evaluate the following user story on a 0-10 scale for each parameter.
RESPOND ONLY WITH A JSON OBJECT IN THIS EXACT FORMAT:
{
  "scores": {
    "Completeness": <0-10>,
    "Clarity": <0-10>,
    "AcceptanceCriteria": <0-10>,
    "Specificity": <0-10>,
    "Structure": <0-10>
  },
  "recommendations": [
    "<suggestion 1>",
    "<suggestion 2>",
    "<suggestion 3>"
  ],
  "comment": "<overall assessment>"
}

Story to evaluate: "${story}"`;

    try {
        const resp = await mistral.chat({
            model: 'mistral-tiny',
            messages: [{ role: 'user', content: prompt }]
        });
        
        const content = resp.choices?.[0]?.message?.content || '';
        
        // Find the first JSON-like structure in the response
        const jsonMatch = content.match(/\{[\s\S]*?\}(?=\s*$)/);
        if (!jsonMatch) {
            console.warn('No JSON found in response:', content);
            throw new Error('Invalid response format');
        }

        let parsed;
        try {
            parsed = JSON.parse(jsonMatch[0]);
        } catch (parseErr) {
            console.warn('JSON parse failed:', jsonMatch[0]);
            throw parseErr;
        }

        if (!parsed.scores) {
            throw new Error('Missing scores in response');
        }

        const scores = parsed.scores;
        const breakdown: any = {
            Completeness: Number(scores.Completeness) || 0,
            Clarity: Number(scores.Clarity) || 0,
            AcceptanceCriteria: Number(scores.AcceptanceCriteria) || 0,
            Specificity: Number(scores.Specificity) || 0,
            Structure: Number(scores.Structure) || 0
        };

        // Validate scores are in range
        Object.entries(breakdown).forEach(([key, value]) => {
            if (typeof value !== 'number' || value < 0 || value > 10) {
                breakdown[key] = 5; // Default to middle score for invalid values
            }
        });

        const vals = Object.values(breakdown) as number[];
        const total = Math.round((vals.reduce((a: number, b: number) => a + b, 0) / 50) * 100);
        const recommendations: string[] = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

        return {
            totalScore: total,
            breakdown,
            recommendations: recommendations.slice(0, 3), // Limit to top 3
            comment: typeof parsed.comment === 'string' ? parsed.comment : ''
        };
    } catch (err) {
        console.error('Quality evaluation failed:', err);
        // Fallback to basic heuristic scoring
        const breakdown: any = {
            Completeness: /As a .+ I want .+ so that .+/i.test(story) ? 8 : 5,
            Clarity: story.length > 40 ? 7 : 5,
            AcceptanceCriteria: /acceptance criteria:/i.test(story) ? 8 : 3,
            Specificity: /\d+|\buser\b|ui|click|select|enter/i.test(story) ? 6 : 4,
            Structure: /As a|I want|so that/i.test(story) ? 8 : 5
        };
        const vals = Object.values(breakdown) as number[];
        const total = Math.round((vals.reduce((a: number, b: number) => a + b, 0) / 50) * 100);
        
        return {
            totalScore: total,
            breakdown,
            recommendations: [
                'Add clear Given-When-Then acceptance criteria.',
                'Include specific measurable outcomes.',
                'Ensure all role/action/value segments are present.'
            ],
            comment: 'Scored using fallback heuristics due to LLM error'
        };
    }

    // Fallback heuristic scoring
    const breakdown: any = {
        Completeness: /As a .+ I want .+ so that .+/i.test(story) ? 8 : 5,
        Clarity: story.length > 40 ? 7 : 5,
        AcceptanceCriteria: /acceptance criteria:/i.test(story) ? 8 : 3,
        Specificity: /\d+|\buser\b|ui|click|select|enter/i.test(story) ? 6 : 4,
        Structure: /As a|I want|so that/i.test(story) ? 8 : 5
    };
    const vals = Object.values(breakdown) as number[];
    const total = Math.round((vals.reduce((a: number, b: number) => a + b, 0) / 50) * 100);
    const recommendations = [];
    if (breakdown.AcceptanceCriteria < 6) recommendations.push('Add clear Given-When-Then acceptance criteria.');
    if (breakdown.Specificity < 6) recommendations.push('Add concrete examples and measurable conditions.');
    if (breakdown.Completeness < 6) recommendations.push('Include missing role/action/value segments.');

    return { totalScore: total, breakdown, recommendations, comment: 'heuristic fallback' };
}