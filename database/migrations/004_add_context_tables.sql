-- Migration: Add Context Management Tables
-- Story: 3.3 Context Management System
-- Date: 2025-08-04

-- Conversation contexts table
CREATE TABLE electrical_analysis.conversation_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES electrical_analysis.sessions(id) ON DELETE CASCADE,
    context_data JSONB NOT NULL,
    cumulative_context JSONB DEFAULT '{}',
    turn_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    storage_size_bytes INTEGER,
    compression_applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Context turns for detailed conversation tracking
CREATE TABLE electrical_analysis.context_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID REFERENCES electrical_analysis.conversation_contexts(id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,
    query_id UUID REFERENCES electrical_analysis.queries(id),
    context_contributions JSONB DEFAULT '[]',
    follow_up_detected BOOLEAN DEFAULT FALSE,
    relevance_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Context references for tracking query relationships
CREATE TABLE electrical_analysis.context_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_query_id UUID REFERENCES electrical_analysis.queries(id),
    target_query_id UUID REFERENCES electrical_analysis.queries(id),
    reference_type VARCHAR(20) NOT NULL CHECK (reference_type IN ('pronoun', 'implicit', 'temporal', 'spatial')),
    reference_text TEXT NOT NULL,
    resolved_entity TEXT,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_conversation_contexts_session_id ON electrical_analysis.conversation_contexts(session_id);
CREATE INDEX idx_conversation_contexts_expires_at ON electrical_analysis.conversation_contexts(expires_at);
CREATE INDEX idx_context_turns_context_id ON electrical_analysis.context_turns(context_id);
CREATE INDEX idx_context_turns_query_id ON electrical_analysis.context_turns(query_id);
CREATE INDEX idx_context_references_source_query_id ON electrical_analysis.context_references(source_query_id);
CREATE INDEX idx_context_references_target_query_id ON electrical_analysis.context_references(target_query_id);

-- GIN indexes for JSONB columns
CREATE INDEX idx_conversation_contexts_context_data ON electrical_analysis.conversation_contexts USING GIN (context_data);
CREATE INDEX idx_conversation_contexts_cumulative_context ON electrical_analysis.conversation_contexts USING GIN (cumulative_context);
CREATE INDEX idx_context_turns_contributions ON electrical_analysis.context_turns USING GIN (context_contributions);

-- Function to automatically update last_updated timestamp
CREATE OR REPLACE FUNCTION update_conversation_context_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on context updates
CREATE TRIGGER trg_update_conversation_context_timestamp
    BEFORE UPDATE ON electrical_analysis.conversation_contexts
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_context_timestamp();

-- Function to calculate context storage size
CREATE OR REPLACE FUNCTION calculate_context_storage_size()
RETURNS TRIGGER AS $$
BEGIN
    NEW.storage_size_bytes = length(NEW.context_data::text) + length(NEW.cumulative_context::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to calculate storage size on insert/update
CREATE TRIGGER trg_calculate_context_storage_size
    BEFORE INSERT OR UPDATE ON electrical_analysis.conversation_contexts
    FOR EACH ROW
    EXECUTE FUNCTION calculate_context_storage_size();