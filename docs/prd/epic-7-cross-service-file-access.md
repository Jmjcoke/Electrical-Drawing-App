# Epic 7: Cross-Service File Access - Brownfield Enhancement

## Epic Goal

Enable seamless file access between microservices in the electrical drawing analysis application, allowing the LLM orchestrator to access converted PDF images from the file processor while maintaining existing session security boundaries.

## Epic Description

### Existing System Context

**Current relevant functionality:**
- File processor service handles PDF uploads and converts them to images
- Images stored in session directories: `backend/storage/sessions/{sessionId}/converted_images/`
- LLM orchestrator analyzes images but currently has no clean cross-service file access
- UUID-based session isolation maintains security boundaries

**Technology stack:**
- Node.js/TypeScript microservices architecture  
- Docker containerization for service deployment
- Express.js frameworks for API endpoints
- Existing shared libraries in `backend/shared/`

**Integration points:**
- File processor creates and manages session directories
- LLM orchestrator needs read access to converted images
- Docker volume sharing between containers
- Existing session management and cleanup processes

### Enhancement Details

**What's being added:**
- SharedStorageService abstraction for cross-service file operations
- Docker shared volume configuration for file access
- Service-level permission checking for session access
- Integration layers in both file-processor and llm-orchestrator

**How it integrates:**
- Follows existing shared library patterns in `backend/shared/services/`
- Extends existing storage.service.ts without breaking changes
- Uses Docker volumes for secure cross-container file access
- Maintains current UUID session structure and cleanup processes

**Success criteria:**
- Cross-service file access within 100ms response time
- Existing session security boundaries preserved
- No regression in current file processor functionality
- All existing file operations continue working unchanged

## Stories

1. **Story 7.1: SharedStorageService Implementation**
   Create core shared storage service with cross-service file access, Docker volume configuration, and integration with existing file-processor and llm-orchestrator services.

## Compatibility Requirements

- ✅ Existing APIs remain unchanged - no breaking changes to file processor endpoints
- ✅ Database schema changes are backward compatible - no database changes required  
- ✅ UI changes follow existing patterns - no frontend changes needed
- ✅ Performance impact is minimal - target <100ms overhead for cross-service access

## Risk Mitigation

**Primary Risk:** Breaking existing file processor session management or introducing security vulnerabilities in cross-service access

**Mitigation:** 
- Implement SharedStorageService as abstraction layer over existing storage patterns
- Preserve all current session isolation and cleanup mechanisms  
- Use Docker volumes for secure container-level file sharing
- Comprehensive testing of existing file operations to prevent regression

**Rollback Plan:** 
- Remove SharedStorageService integration from both services
- Revert Docker compose configuration to single-service volumes
- All existing functionality continues to work as services fall back to direct file operations

## Definition of Done

- ✅ Story 7.1 completed with all acceptance criteria met
- ✅ Existing file processor functionality verified through regression testing
- ✅ Cross-service file access working correctly with <100ms performance
- ✅ Docker volume integration functional in development and test environments
- ✅ No regression in existing session management or file operations

## Architecture Alignment

This enhancement aligns with existing architecture patterns:

**Follows Current Patterns:**
- Shared service libraries in `backend/shared/services/`
- TypeScript interfaces and dependency injection
- Docker containerization approach
- UUID-based session management

**Integration Points Verified:**
- File processor storage service at `backend/services/file-processor/src/services/storage.service.ts`
- LLM orchestrator analysis endpoints need file access capability
- Existing Docker compose configuration can be extended with shared volumes
- Session cleanup processes will continue to work with shared storage

**Source References:**
- [Source: architecture/source-tree.md#backend-structure] - Confirmed shared services pattern
- [Source: Current file system] - Verified existing session directory structure
- [Source: architecture/tech-stack.md] - Confirmed Docker and TypeScript usage

## Risk Assessment: LOW

This is a well-scoped infrastructure enhancement that:
- Uses established patterns already in the codebase
- Adds capability without changing existing interfaces
- Has clear rollback path (remove integration, keep existing file operations)
- Addresses documented need for cross-service file access in microservices architecture