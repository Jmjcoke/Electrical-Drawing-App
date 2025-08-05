-- Migration: Add Symbol Detection Tables
-- Story: 4.1 Symbol Detection Engine  
-- Date: 2025-08-05
-- Task: 4.1.4 Database Storage Integration

-- Symbol detection results table
CREATE TABLE electrical_analysis.symbol_detection_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID, -- Allow nullable for direct uploads
    document_id UUID NOT NULL, -- Required for all detections
    session_id UUID NOT NULL, -- Required for session management
    page_number INTEGER NOT NULL DEFAULT 1,
    processing_time_ms INTEGER NOT NULL,
    overall_confidence DECIMAL(3,2) CHECK (overall_confidence >= 0 AND overall_confidence <= 1),
    detection_metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detected symbols table
CREATE TABLE electrical_analysis.detected_symbols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detection_result_id UUID REFERENCES electrical_analysis.symbol_detection_results(id) ON DELETE CASCADE,
    symbol_type VARCHAR(50) NOT NULL,
    symbol_category VARCHAR(20) NOT NULL CHECK (symbol_category IN ('passive', 'active', 'connector', 'power', 'protection', 'logic', 'custom')),
    description TEXT,
    confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    location_x DECIMAL(8,4) NOT NULL,      -- Normalized coordinates
    location_y DECIMAL(8,4) NOT NULL,      -- Normalized coordinates
    original_x INTEGER,                     -- Original pixel coordinates
    original_y INTEGER,                     -- Original pixel coordinates
    image_width INTEGER,                    -- Original image dimensions
    image_height INTEGER,                   -- Original image dimensions
    bounding_box JSONB NOT NULL,           -- {x, y, width, height, rotation?, area}
    symbol_features JSONB DEFAULT '{}',    -- Geometric and visual features
    detection_method VARCHAR(30) NOT NULL CHECK (detection_method IN ('pattern_matching', 'ml_classification', 'llm_analysis', 'consensus')),
    validation_score DECIMAL(3,2) CHECK (validation_score >= 0 AND validation_score <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Symbol library reference table for pattern matching
CREATE TABLE electrical_analysis.symbol_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol_type VARCHAR(50) NOT NULL,
    symbol_category VARCHAR(20) NOT NULL,
    symbol_name VARCHAR(100) NOT NULL,
    symbol_description TEXT,
    template_data BYTEA,                    -- Template image data for pattern matching
    feature_vector JSONB,                   -- Extracted features for ML classification
    industry_standard VARCHAR(50),          -- IEEE, IEC, ANSI, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1
);

-- Detection performance metrics
CREATE TABLE electrical_analysis.detection_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detection_result_id UUID REFERENCES electrical_analysis.symbol_detection_results(id) ON DELETE CASCADE,
    metric_type VARCHAR(30) NOT NULL,      -- 'processing_time', 'accuracy', 'false_positive_rate'
    metric_value DECIMAL(10,4) NOT NULL,
    metric_unit VARCHAR(20),               -- 'ms', 'percentage', etc.
    benchmark_comparison JSONB,            -- Comparison with benchmarks
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detection job tracking table for async processing
CREATE TABLE electrical_analysis.detection_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL,
    session_id UUID NOT NULL,
    page_number INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    progress_stage VARCHAR(100),
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    detection_settings JSONB DEFAULT '{}',
    error_message TEXT,
    result_id UUID REFERENCES electrical_analysis.symbol_detection_results(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Symbol detection cache for performance optimization
CREATE TABLE electrical_analysis.detection_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_hash VARCHAR(64) NOT NULL,    -- SHA-256 hash of document content
    page_number INTEGER NOT NULL,
    detection_settings_hash VARCHAR(64) NOT NULL, -- Hash of detection settings
    cached_result JSONB NOT NULL,          -- Cached SymbolDetectionResult
    hit_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_symbol_detection_results_query_id ON electrical_analysis.symbol_detection_results(query_id);
CREATE INDEX idx_symbol_detection_results_document_id ON electrical_analysis.symbol_detection_results(document_id);
CREATE INDEX idx_symbol_detection_results_session_id ON electrical_analysis.symbol_detection_results(session_id);
CREATE INDEX idx_symbol_detection_results_created_at ON electrical_analysis.symbol_detection_results(created_at);

CREATE INDEX idx_detected_symbols_detection_result_id ON electrical_analysis.detected_symbols(detection_result_id);
CREATE INDEX idx_detected_symbols_type_category ON electrical_analysis.detected_symbols(symbol_type, symbol_category);
CREATE INDEX idx_detected_symbols_confidence ON electrical_analysis.detected_symbols(confidence);

CREATE INDEX idx_symbol_library_type_category ON electrical_analysis.symbol_library(symbol_type, symbol_category);
CREATE INDEX idx_symbol_library_name ON electrical_analysis.symbol_library(symbol_name);

CREATE INDEX idx_detection_metrics_result_id ON electrical_analysis.detection_metrics(detection_result_id);
CREATE INDEX idx_detection_metrics_type ON electrical_analysis.detection_metrics(metric_type);

CREATE INDEX idx_detection_jobs_document_id ON electrical_analysis.detection_jobs(document_id);
CREATE INDEX idx_detection_jobs_session_id ON electrical_analysis.detection_jobs(session_id);
CREATE INDEX idx_detection_jobs_status ON electrical_analysis.detection_jobs(status);
CREATE INDEX idx_detection_jobs_created_at ON electrical_analysis.detection_jobs(created_at);

CREATE INDEX idx_detection_cache_document_hash ON electrical_analysis.detection_cache(document_hash, page_number);
CREATE INDEX idx_detection_cache_expires_at ON electrical_analysis.detection_cache(expires_at);
CREATE INDEX idx_detection_cache_last_accessed ON electrical_analysis.detection_cache(last_accessed);

-- GIN indexes for JSONB columns
CREATE INDEX idx_symbol_detection_results_metadata ON electrical_analysis.symbol_detection_results USING GIN (detection_metadata);
CREATE INDEX idx_detected_symbols_bounding_box ON electrical_analysis.detected_symbols USING GIN (bounding_box);
CREATE INDEX idx_detected_symbols_features ON electrical_analysis.detected_symbols USING GIN (symbol_features);
CREATE INDEX idx_symbol_library_feature_vector ON electrical_analysis.symbol_library USING GIN (feature_vector);
CREATE INDEX idx_detection_metrics_comparison ON electrical_analysis.detection_metrics USING GIN (benchmark_comparison);
CREATE INDEX idx_detection_jobs_settings ON electrical_analysis.detection_jobs USING GIN (detection_settings);
CREATE INDEX idx_detection_cache_result ON electrical_analysis.detection_cache USING GIN (cached_result);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_symbol_detection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp on detection results updates
CREATE TRIGGER trg_update_symbol_detection_timestamp
    BEFORE UPDATE ON electrical_analysis.symbol_detection_results
    FOR EACH ROW
    EXECUTE FUNCTION update_symbol_detection_timestamp();

-- Function to update cache hit count and last accessed
CREATE OR REPLACE FUNCTION update_detection_cache_access()
RETURNS TRIGGER AS $$
BEGIN
    NEW.hit_count = COALESCE(OLD.hit_count, 0) + 1;
    NEW.last_accessed = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update cache access statistics
CREATE TRIGGER trg_update_detection_cache_access
    BEFORE UPDATE ON electrical_analysis.detection_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_detection_cache_access();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_detection_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM electrical_analysis.detection_cache 
    WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Initial symbol library data for common electrical symbols
INSERT INTO electrical_analysis.symbol_library 
(symbol_type, symbol_category, symbol_name, symbol_description, industry_standard) VALUES
-- Passive Components
('resistor', 'passive', 'Fixed Resistor', 'Standard fixed value resistor', 'IEEE'),
('capacitor', 'passive', 'Fixed Capacitor', 'Standard fixed value capacitor', 'IEEE'),
('inductor', 'passive', 'Fixed Inductor', 'Standard fixed value inductor', 'IEEE'),

-- Active Components  
('diode', 'active', 'Standard Diode', 'Basic semiconductor diode', 'IEEE'),
('transistor', 'active', 'BJT Transistor', 'Bipolar junction transistor', 'IEEE'),
('operational_amplifier', 'active', 'Op-Amp', 'Operational amplifier', 'IEEE'),

-- Logic Components
('logic_gate', 'logic', 'AND Gate', 'Logic AND gate', 'IEEE'),
('logic_gate', 'logic', 'OR Gate', 'Logic OR gate', 'IEEE'),
('logic_gate', 'logic', 'NOT Gate', 'Logic NOT gate', 'IEEE'),

-- Power Components
('power_supply', 'power', 'DC Supply', 'DC power supply', 'IEEE'),
('battery', 'power', 'Battery Cell', 'Single battery cell', 'IEEE'),
('ground', 'power', 'Ground', 'Circuit ground reference', 'IEEE'),

-- Connectors
('connector', 'connector', 'Terminal', 'Connection terminal', 'IEEE'),

-- Protection
('fuse', 'protection', 'Fuse', 'Protective fuse', 'IEEE');