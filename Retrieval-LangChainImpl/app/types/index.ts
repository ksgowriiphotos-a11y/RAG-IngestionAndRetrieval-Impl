export interface UserStory {
    _id?: string;
    content: string;
    key?: string;
    summary?: string;
    metadata: {
        description?: string;
        acceptanceCriteria?: string[] | string;
        epic?: string;
        sprint?: string;
        points?: number;
        priority?: 'high' | 'medium' | 'low';
        status?: 'completed' | 'in-progress' | 'not-started';
        assignee?: string;
        createdDate?: string;
        [key: string]: any;
    };
    embedding?: number[];
}

export interface RankedStory extends UserStory {
    vector_score: number;
    bm25_score: number;
    vector_score_norm: number;
    bm25_score_norm: number;
    hybrid_score: number;
    // optional enhanced fields
    llm_score?: number;
    llm_reason?: string;
    evidence?: string;
    hybrid_score_final?: number;
}

export interface RAGPipelineResponse {
    normalized_new_story: string;
    refined_story: string | null;
    story_quality_score: number;
    ranked_related_stories: RankedStory[];
    errors: Array<{
        code: string;
        message: string;
        details?: Record<string, any>;
    }>;
    quality_breakdown?: Record<string, number>;
    recommendations?: string[];
    timings?: {
        overall_ms?: number;
        embedding_ms?: number;
        search_ms?: number;
        llm_scoring_ms?: number;
        refinement_ms?: number;
        quality_eval_ms?: number;
    };
}

export interface RAGConfig {
    vectorWeight: number;
    bm25Weight: number;
    hybridWeight?: number;
    topK: number;
}