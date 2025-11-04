export interface UserStory {
    _id?: string;
    content: string;
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
}

export interface RAGConfig {
    vectorWeight: number;
    bm25Weight: number;
    topK: number;
}