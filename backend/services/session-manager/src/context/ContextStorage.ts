/**
 * ContextStorage Service
 * Database persistence layer for conversation contexts
 */

import { Pool, PoolClient } from 'pg';
import type {
  ConversationContext,
  ConversationTurn,
  ContextStorageConfig
} from '../../../../shared/types/context';

export interface ContextStorageOptions {
  database: Pool;
  config: ContextStorageConfig;
}

export class ContextStorageService {
  private readonly db: Pool;
  private readonly config: ContextStorageConfig;

  constructor(options: ContextStorageOptions) {
    this.db = options.database;
    this.config = options.config;
  }

  /**
   * Stores a conversation context in the database
   * @param context - Context to store
   * @returns Promise resolving to stored context ID
   */
  async storeContext(context: ConversationContext): Promise<string> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Store main context
      const contextQuery = `
        INSERT INTO electrical_analysis.conversation_contexts 
        (id, session_id, context_data, cumulative_context, turn_count, expires_at, compression_applied)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          context_data = EXCLUDED.context_data,
          cumulative_context = EXCLUDED.cumulative_context,
          turn_count = EXCLUDED.turn_count,
          expires_at = EXCLUDED.expires_at,
          compression_applied = EXCLUDED.compression_applied,
          last_updated = NOW()
        RETURNING id
      `;

      const contextData = JSON.stringify({
        conversationThread: context.conversationThread,
        metadata: context.metadata
      });

      const cumulativeContextData = JSON.stringify({
        extractedEntities: Array.from(context.cumulativeContext.extractedEntities.entries()),
        documentContext: context.cumulativeContext.documentContext,
        topicProgression: context.cumulativeContext.topicProgression,
        keyInsights: context.cumulativeContext.keyInsights,
        relationshipMap: context.cumulativeContext.relationshipMap
      });

      const contextResult = await client.query(contextQuery, [
        context.id,
        context.sessionId,
        contextData,
        cumulativeContextData,
        context.conversationThread.length,
        context.expiresAt,
        context.metadata.compressionLevel > 0
      ]);

      // Store individual turns
      for (const turn of context.conversationThread) {
        await this.storeTurn(client, context.id, turn);
      }

      await client.query('COMMIT');
      return contextResult.rows[0].id;

    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to store context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      client.release();
    }
  }

  /**
   * Retrieves a conversation context by session ID
   * @param sessionId - Session identifier
   * @returns Promise resolving to context or null if not found
   */
  async getContextBySessionId(sessionId: string): Promise<ConversationContext | null> {
    const query = `
      SELECT id, session_id, context_data, cumulative_context, turn_count, 
             last_updated, expires_at, storage_size_bytes, compression_applied, created_at
      FROM electrical_analysis.conversation_contexts 
      WHERE session_id = $1 AND expires_at > NOW()
      ORDER BY last_updated DESC
      LIMIT 1
    `;

    const result = await this.db.query(query, [sessionId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return this.mapRowToContext(row);
  }

  /**
   * Retrieves a conversation context by ID
   * @param contextId - Context identifier
   * @returns Promise resolving to context or null if not found
   */
  async getContextById(contextId: string): Promise<ConversationContext | null> {
    const query = `
      SELECT id, session_id, context_data, cumulative_context, turn_count, 
             last_updated, expires_at, storage_size_bytes, compression_applied, created_at
      FROM electrical_analysis.conversation_contexts 
      WHERE id = $1 AND expires_at > NOW()
    `;

    const result = await this.db.query(query, [contextId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToContext(result.rows[0]);
  }

  /**
   * Updates context access metadata
   * @param contextId - Context identifier
   * @returns Promise resolving when update is complete
   */
  async updateAccessMetadata(contextId: string): Promise<void> {
    const query = `
      UPDATE electrical_analysis.conversation_contexts 
      SET context_data = jsonb_set(
        jsonb_set(
          context_data,
          '{metadata,lastAccessed}',
          to_jsonb(NOW())
        ),
        '{metadata,accessCount}',
        to_jsonb((context_data->'metadata'->>'accessCount')::integer + 1)
      )
      WHERE id = $1
    `;

    await this.db.query(query, [contextId]);
  }

  /**
   * Stores a context reference relationship
   * @param sourceQueryId - Source query ID
   * @param targetQueryId - Target query ID
   * @param referenceType - Type of reference
   * @param referenceText - Reference text
   * @param resolvedEntity - Resolved entity (optional)
   * @param confidence - Confidence score
   * @returns Promise resolving to reference ID
   */
  async storeContextReference(
    sourceQueryId: string,
    targetQueryId: string,
    referenceType: 'pronoun' | 'implicit' | 'temporal' | 'spatial',
    referenceText: string,
    resolvedEntity?: string,
    confidence: number = 0.0
  ): Promise<string> {
    const query = `
      INSERT INTO electrical_analysis.context_references 
      (source_query_id, target_query_id, reference_type, reference_text, resolved_entity, confidence_score)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const result = await this.db.query(query, [
      sourceQueryId,
      targetQueryId,
      referenceType,
      referenceText,
      resolvedEntity,
      confidence
    ]);

    return result.rows[0].id;
  }

  /**
   * Retrieves context references for a query
   * @param queryId - Query identifier
   * @returns Promise resolving to array of references
   */
  async getContextReferences(queryId: string): Promise<Array<{
    id: string;
    sourceQueryId: string;
    targetQueryId: string;
    referenceType: string;
    referenceText: string;
    resolvedEntity?: string;
    confidenceScore: number;
  }>> {
    const query = `
      SELECT id, source_query_id, target_query_id, reference_type, 
             reference_text, resolved_entity, confidence_score
      FROM electrical_analysis.context_references 
      WHERE source_query_id = $1 OR target_query_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(query, [queryId]);
    
    return result.rows.map(row => ({
      id: row.id,
      sourceQueryId: row.source_query_id,
      targetQueryId: row.target_query_id,
      referenceType: row.reference_type,
      referenceText: row.reference_text,
      resolvedEntity: row.resolved_entity,
      confidenceScore: parseFloat(row.confidence_score)
    }));
  }

  /**
   * Deletes expired contexts
   * @returns Promise resolving to number of deleted contexts
   */
  async cleanupExpiredContexts(): Promise<number> {
    const query = `
      DELETE FROM electrical_analysis.conversation_contexts 
      WHERE expires_at < NOW()
    `;

    const result = await this.db.query(query);
    return result.rowCount || 0;
  }

  /**
   * Gets storage statistics
   * @returns Promise resolving to storage stats
   */
  async getStorageStats(): Promise<{
    totalContexts: number;
    totalStorageBytes: number;
    averageStoragePerContext: number;
    expiredContexts: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_contexts,
        SUM(storage_size_bytes) as total_storage_bytes,
        AVG(storage_size_bytes) as average_storage_per_context,
        COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_contexts
      FROM electrical_analysis.conversation_contexts
    `;

    const result = await this.db.query(query);
    const row = result.rows[0];

    return {
      totalContexts: parseInt(row.total_contexts),
      totalStorageBytes: parseInt(row.total_storage_bytes || '0'),
      averageStoragePerContext: parseFloat(row.average_storage_per_context || '0'),
      expiredContexts: parseInt(row.expired_contexts)
    };
  }

  // Private helper methods

  private async storeTurn(client: PoolClient, contextId: string, turn: ConversationTurn): Promise<void> {
    const query = `
      INSERT INTO electrical_analysis.context_turns 
      (id, context_id, turn_number, query_id, context_contributions, follow_up_detected, relevance_score)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        context_contributions = EXCLUDED.context_contributions,
        follow_up_detected = EXCLUDED.follow_up_detected,
        relevance_score = EXCLUDED.relevance_score
    `;

    await client.query(query, [
      turn.id,
      contextId,
      turn.turnNumber,
      turn.query.id,
      JSON.stringify(turn.contextContributions),
      turn.followUpDetected,
      null // relevance_score will be calculated by other services
    ]);
  }

  private mapRowToContext(row: any): ConversationContext {
    const contextData = row.context_data;
    const cumulativeContextData = row.cumulative_context;

    // Reconstruct Map from array of entries
    const extractedEntities = new Map(cumulativeContextData.extractedEntities || []);

    return {
      id: row.id,
      sessionId: row.session_id,
      conversationThread: contextData.conversationThread || [],
      cumulativeContext: {
        extractedEntities,
        documentContext: cumulativeContextData.documentContext || [],
        topicProgression: cumulativeContextData.topicProgression || [],
        keyInsights: cumulativeContextData.keyInsights || [],
        relationshipMap: cumulativeContextData.relationshipMap || []
      },
      lastUpdated: new Date(row.last_updated),
      expiresAt: new Date(row.expires_at),
      metadata: {
        createdAt: new Date(row.created_at),
        lastAccessed: new Date(contextData.metadata?.lastAccessed || row.created_at),
        accessCount: contextData.metadata?.accessCount || 0,
        compressionLevel: contextData.metadata?.compressionLevel || 0,
        tags: contextData.metadata?.tags || []
      }
    };
  }
}