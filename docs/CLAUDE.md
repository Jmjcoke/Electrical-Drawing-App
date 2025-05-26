# Documentation Directory - Claude Code Configuration

## Overview

Comprehensive documentation for Electrical Orchestrator following BMAD Method standards, including project requirements, architecture, stories, and implementation summaries.

## BMAD Method Integration

### Documentation Workflow
This directory implements the **BMAD Method** documentation standards:

1. **Project Briefs** → **PRDs** → **Architecture** → **Stories** → **Implementation Summaries**
2. **Iterative Refinement**: Documents evolve throughout project lifecycle
3. **Quality Control**: Human oversight ensures documentation accuracy
4. **Strategic Oversight**: Maintains alignment with project vision

### BMAD Personas for Documentation
```markdown
# For documentation review/updates, activate appropriate persona:

# Project Requirements & PRD updates
I need to review/update project documentation. Please activate the Product Manager (Jack) persona.

# Architecture documentation  
I need to work on system architecture. Please activate the Architect (Mo) persona.

# Story management and planning
I need to manage stories and backlogs. Please activate the Product Owner (Curly) persona.

# Frontend/UX documentation
I need to work on frontend specifications. Please activate the Design Architect (Millie) persona.
```

## Documentation Structure

### Core Documents
```
docs/
├── project-brief.md                    # Initial project definition (Analyst output)
├── electrical-orchestrator-prd.md     # Product Requirements Document (PM output)
├── electrical-orchestrator-architecture.md  # System Architecture (Architect output)
├── frontend-architecture.md           # Frontend Architecture (Design Architect output)
├── front-end-spec.md                  # UI/UX Specification (Design Architect output)
├── stories/                           # BMAD User Stories
│   ├── 1.1.story.md                  # Epic 1 Stories (Infrastructure)
│   ├── 1.2.story.md
│   ├── 1.3.story.md
│   ├── 2.1.story.md                  # Epic 2 Stories (PDF Processing)
│   ├── 2.2.story.md
│   └── 2.3.story.md
├── task-summaries/                    # Implementation summaries
│   ├── README.md                      # Complete task overview
│   └── story-[epic]-[story]-[name]/   # Individual story summaries
└── CLAUDE.md                          # This configuration file
```

### BMAD Checklist Results
```
docs/
├── architect-checklist-results.md     # Architecture validation
├── frontend-architecture-checklist-results.md  # Frontend validation
├── pm-checklist-results.md           # PM process validation
└── stories/                           # Story validation results
    ├── 1.1.story-checklist-results.md
    ├── 1.2.story-checklist-results.md
    └── 1.3.story-checklist-results.md
```

## Working with Documentation

### Reading Documentation Workflow
```bash
# Essential reading order for new team members or context loading
1. docs/project-brief.md                 # Project overview and goals
2. docs/electrical-orchestrator-prd.md   # Detailed requirements and epics  
3. docs/electrical-orchestrator-architecture.md  # System design
4. docs/frontend-architecture.md         # Frontend technical design
5. docs/front-end-spec.md               # UI/UX specifications
6. docs/stories/[current-epic].[story].story.md  # Current implementation focus
```

### Documentation Update Workflow
```markdown
# When updating documentation, follow BMAD Method:

1. **Identify Document Type**: PRD, Architecture, Story, etc.
2. **Activate Appropriate Persona**: Use BMAD Orchestrator to embody right specialist
3. **Load Current Context**: Read existing document and dependencies
4. **Apply Changes**: Make updates following BMAD standards
5. **Validate Changes**: Run appropriate checklist if available
6. **Update Cross-References**: Ensure consistency across related documents
```

## Key Documentation Standards

### Story Format (BMAD Standard)
```markdown
# Story [Epic].[Number]: [Title]

## Status: [Approved|In-Progress|Review|Done]

## Story
- As a [user type]
- I want [functionality]
- so that [business value]

## Acceptance Criteria (ACs)
1. **Criterion 1**: Detailed requirement with measurable outcome
2. **Criterion 2**: Detailed requirement with measurable outcome

## Tasks / Subtasks
- [ ] **Task 1**: Implementation details
  - [ ] Subtask 1.1: Specific technical requirement
  - [ ] Subtask 1.2: Specific technical requirement
- [ ] **Task 2**: Implementation details

## Dev Technical Guidance
### **Technical Implementation Details**
- Architecture patterns to follow
- Performance requirements
- Security considerations
- Integration points

## Story Progress Notes
### Agent Model Used: `Claude Sonnet 4 (2025-05-14)`
### Completion Notes List
- Implementation highlights
- Technical decisions made
- Challenges overcome

### Change Log
- **Date**: Description of changes made

## Story Definition of Done (DoD) Checklist Report
### 1. Requirements Met: ✅/❌
- [x] All functional requirements implemented
- [x] All acceptance criteria met

### 2. Coding Standards & Project Structure: ✅/❌
- [x] Code follows project standards
- [x] Proper error handling implemented

### 3. Testing: ✅/❌
- [x] Unit tests implemented and passing
- [x] Integration tests implemented and passing

### 4. Documentation: ✅/❌
- [x] Code documentation complete
- [x] User documentation updated

### Final Confirmation: ✅/❌
- [x] All DoD items verified and story ready for review
```

### Architecture Document Standards
```markdown
# System Architecture Document

## Architecture Overview
High-level system design with clear component relationships

## Technology Stack
### Backend
- **Language**: Python 3.11+
- **Framework**: FastAPI with async/await
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Caching**: Redis

### Frontend  
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript with strict configuration
- **Styling**: Tailwind CSS
- **State**: Zustand + React Query

## Component Architecture
### Microservices Structure
Detailed breakdown of each service with:
- Purpose and responsibilities
- API interfaces
- Dependencies
- Performance requirements

## Data Architecture
### Database Design
- Entity relationships
- Data flow patterns
- Performance optimization

## Security Architecture
- Authentication and authorization
- Data protection measures
- Network security

## Deployment Architecture
- Infrastructure components
- Scaling considerations
- Monitoring and observability
```

## Documentation Quality Standards

### BMAD Quality Control Checklist
```markdown
# Documentation Quality Checklist (Apply to all documents)

## Content Quality
- [ ] **Accuracy**: Information is current and correct
- [ ] **Completeness**: All required sections present
- [ ] **Clarity**: Technical concepts explained clearly
- [ ] **Consistency**: Terminology used consistently

## Structure & Format
- [ ] **Organization**: Logical information flow
- [ ] **Formatting**: Consistent markdown formatting
- [ ] **Navigation**: Clear headings and table of contents
- [ ] **Cross-References**: Links to related documents

## Technical Standards  
- [ ] **Code Examples**: Working, tested code samples
- [ ] **Diagrams**: Architecture diagrams current and clear
- [ ] **APIs**: Endpoint documentation complete
- [ ] **Dependencies**: Requirements clearly specified

## Maintenance
- [ ] **Versioning**: Document version and last updated
- [ ] **Change Log**: Record of significant changes
- [ ] **Review Date**: Next scheduled review date
- [ ] **Owner**: Document maintainer identified
```

### Code Documentation in Documents
```markdown
# When including code in documentation:

## API Examples
```http
POST /api/v1/components/recognize
Content-Type: multipart/form-data

{
  "image": (binary),
  "bounding_boxes": [
    {"x": 100, "y": 100, "width": 200, "height": 150}
  ]
}
```

## Response Format
```json
{
  "success": true,
  "results": [
    {
      "component_id": "comp_001",
      "category": "breaker",
      "confidence": 0.95,
      "specifications": {
        "manufacturer": "Square D",
        "model_number": "QO120"
      }
    }
  ]
}
```

## Configuration Examples
```yaml
# docker-compose.yml
services:
  component-intelligence:
    build: ./src/backend/services/component-intelligence
    ports:
      - "8001:8001"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/db
```
```

## Story Management Workflow

### Story Lifecycle (BMAD Method)
```markdown
# Story States and Transitions

1. **Draft**: Initial story creation by PO/SM
   - Requirements gathering
   - Acceptance criteria definition
   - Technical guidance creation

2. **Approved**: Ready for implementation
   - All stakeholders reviewed
   - Technical feasibility confirmed
   - Dependencies identified

3. **In-Progress**: Active development
   - Developer agent assigned
   - Implementation following DoD checklist
   - Regular status updates in story file

4. **Review**: Implementation complete
   - DoD checklist completed
   - All tests passing
   - Documentation updated

5. **Done**: Stakeholder approved
   - Functionality verified
   - Story marked complete
   - Implementation summary created
```

### Story Dependencies
```markdown
# Managing Story Dependencies

## Prerequisites Check
Before starting story implementation:
- [ ] All dependent stories completed
- [ ] Required architecture components available  
- [ ] External dependencies approved and available
- [ ] Development environment configured

## Cross-Story References
Stories should reference related work:
- **Builds Upon**: Previous stories that provide foundation
- **Enables**: Future stories that depend on this work
- **Related**: Stories in same epic or functional area
```

## Documentation Maintenance

### Regular Review Schedule
```markdown
# Documentation Review Schedule (BMAD Maintenance)

## Weekly Reviews
- [ ] Active story status updates
- [ ] Task completion tracking
- [ ] Blocker identification and resolution

## Monthly Reviews  
- [ ] PRD accuracy and completeness
- [ ] Architecture document currency
- [ ] Story backlog prioritization

## Quarterly Reviews
- [ ] Complete documentation audit
- [ ] Architecture evolution assessment
- [ ] Process improvement identification
- [ ] Technology stack evaluation
```

### Documentation Tools and Commands
```bash
# Documentation validation
markdownlint docs/                     # Lint markdown files
textlint docs/                        # Grammar and style checking

# Documentation generation
# (if using automated tools)
npx docusaurus build                  # Build documentation site
gitbook build                        # Build GitBook

# Link checking
markdown-link-check docs/**/*.md     # Validate internal/external links

# Documentation metrics
wc -w docs/*.md                      # Word count analysis
find docs -name "*.md" -exec wc -l {} + | tail -1  # Total line count
```

### Integration with BMAD Orchestrator
```markdown
# Using BMAD Orchestrator for Documentation

## Document Creation
"I need to create a new story for Epic 3. Please activate the Product Owner persona and help me draft Story 3.4 following the BMAD story template."

## Document Review
"I need to review the architecture document for accuracy. Please activate the Architect persona and help me validate the technical specifications."

## Document Updates
"The frontend architecture needs updates based on new requirements. Please activate the Design Architect persona and help me revise the frontend specifications."

## Cross-Document Consistency
"I need to ensure the PRD aligns with the current story implementations. Please activate the Product Manager persona and help me review consistency across documents."
```

This documentation configuration ensures comprehensive, maintainable, and BMAD-compliant project documentation that supports effective AI-assisted development with Claude Code.