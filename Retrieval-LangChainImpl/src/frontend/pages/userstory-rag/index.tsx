import { useState } from 'react';
import React from 'react';
// CSV ingest control removed from this page (kept on homepage)
import Layout from '@/src/frontend/components/Layout';
import { RAGPipelineResponse, RankedStory } from '@/src/types';

export default function UserStoryRAG() {
    const [story, setStory] = useState('');
    const [vectorWeight, setVectorWeight] = useState(0.7);
    const [bm25Weight, setBm25Weight] = useState(0.3);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<RAGPipelineResponse | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch('/api/rag-pipeline', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    story,
                    config: {
                        vectorWeight,
                        bm25Weight,
                        topK: 5
                    }
                }),
            });

            const data = await response.json();
            console.log('Received stories:', data.ranked_related_stories);
            setResult(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-8">User Story RAG Pipeline Search</h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Enter User Story
                        </label>
                        <textarea
                            value={story}
                            onChange={(e) => setStory(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            rows={4}
                            placeholder="As a [role], I want [action] so that [value]..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Vector Weight: {vectorWeight}
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={vectorWeight}
                                onChange={(e) => setVectorWeight(parseFloat(e.target.value))}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                BM25 Weight: {bm25Weight}
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={bm25Weight}
                                onChange={(e) => setBm25Weight(parseFloat(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : 'Search Similar Stories'}
                    </button>
                    {/* CSV upload + ingest UI removed from this page; available on homepage */}
                </form>

                {result && (
                    <div className="mt-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-semibold mb-2">Normalized Story</h2>
                            <p className="bg-gray-50 p-4 rounded">{result.normalized_new_story}</p>
                        </div>

                        {result.refined_story && (
                            <div>
                                <h2 className="text-xl font-semibold mb-2">Refined Story</h2>
                                <p className="bg-gray-50 p-4 rounded">{result.refined_story}</p>
                            </div>
                        )}

                        <div>
                            <h2 className="text-xl font-semibold mb-2">
                                Story Quality Score: {result.story_quality_score}%
                            </h2>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full"
                                    style={{ width: `${result.story_quality_score}%` }}
                                />
                            </div>
                        </div>

                        <div>
                            <h2 className="text-xl font-semibold mb-4">Related Stories</h2>
                            <div className="space-y-4">
                                {result.ranked_related_stories.map((story: RankedStory, index: number) => (
                                    <div key={story._id} className="border rounded p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center">
                                                <span className="font-medium text-lg text-indigo-600">Story {index + 1}</span>
                                                {story.metadata?.priority && (
                                                    <span className={`ml-2 px-2 py-1 text-xs rounded ${
                                                        story.metadata.priority === 'high' ? 'bg-red-100 text-red-800' :
                                                        story.metadata.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-green-100 text-green-800'
                                                    }`}>
                                                        {story.metadata.priority.toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm bg-gray-50 p-2 rounded">
                                                <div className="grid grid-cols-2 gap-x-4">
                                                    <div className="text-gray-600">Vector Score:</div>
                                                    <div className="text-right font-mono">{story.vector_score_norm.toFixed(3)}</div>
                                                    <div className="text-gray-600">BM25 Score:</div>
                                                    <div className="text-right font-mono">{story.bm25_score_norm.toFixed(3)}</div>
                                                    <div className="text-gray-600">Hybrid Score:</div>
                                                    <div className="text-right font-mono font-bold text-indigo-600">{story.hybrid_score.toFixed(3)}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="font-medium text-gray-700 mb-2">User Story:</h4>
                                                <p className="text-gray-800 bg-gray-50 p-3 rounded">{story.content}</p>
                                            </div>

                                            {story.metadata?.description && (
                                                <div>
                                                    <h4 className="font-medium text-gray-700 mb-2">Description:</h4>
                                                    <p className="text-gray-600 bg-gray-50 p-3 rounded">{story.metadata.description}</p>
                                                </div>
                                            )}

                                            {story.metadata?.acceptanceCriteria && (
                                                <div>
                                                    <h4 className="font-medium text-gray-700 mb-2">Acceptance Criteria:</h4>
                                                    <ul className="list-disc list-inside space-y-1 text-gray-600 bg-gray-50 p-3 rounded">
                                                        {Array.isArray(story.metadata.acceptanceCriteria) 
                                                            ? story.metadata.acceptanceCriteria.map((criteria, i) => (
                                                                <li key={i}>{criteria}</li>
                                                            ))
                                                            : <li>{story.metadata.acceptanceCriteria}</li>
                                                        }
                                                    </ul>
                                                </div>
                                            )}

                                            {story.metadata && (
                                                <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-3 rounded">
                                                    {story.metadata.epic && (
                                                        <div className="col-span-2">
                                                            <span className="font-medium text-gray-700">Epic: </span>
                                                            <span className="text-gray-600">{story.metadata.epic}</span>
                                                        </div>
                                                    )}
                                                    {story.metadata.sprint && (
                                                        <div>
                                                            <span className="font-medium text-gray-700">Sprint: </span>
                                                            <span className="text-gray-600">{story.metadata.sprint}</span>
                                                        </div>
                                                    )}
                                                    {story.metadata.points && (
                                                        <div>
                                                            <span className="font-medium text-gray-700">Story Points: </span>
                                                            <span className="text-gray-600">{story.metadata.points}</span>
                                                        </div>
                                                    )}
                                                    {story.metadata.assignee && (
                                                        <div>
                                                            <span className="font-medium text-gray-700">Assignee: </span>
                                                            <span className="text-gray-600">{story.metadata.assignee}</span>
                                                        </div>
                                                    )}
                                                    {story.metadata.createdDate && (
                                                        <div>
                                                            <span className="font-medium text-gray-700">Created: </span>
                                                            <span className="text-gray-600">{new Date(story.metadata.createdDate).toLocaleDateString()}</span>
                                                        </div>
                                                    )}
                                                    {story.metadata.status && (
                                                        <div>
                                                            <span className="font-medium text-gray-700">Status: </span>
                                                            <span className={`px-2 py-1 rounded text-xs ${
                                                                story.metadata.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                                story.metadata.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-gray-100 text-gray-800'
                                                            }`}>
                                                                {story.metadata.status.toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {result.errors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded p-4">
                                <h2 className="text-red-800 font-semibold mb-2">Errors</h2>
                                <ul className="list-disc pl-5">
                                    {result.errors.map((error, index) => (
                                        <li key={index} className="text-red-700">
                                            {error.message}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Layout>
    );
}

// CSV ingest control component
