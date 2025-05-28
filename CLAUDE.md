# Electrical Orchestrator - Claude Code Configuration

## Project Overview

**Electrical Orchestrator** is a revolutionary AI-powered platform transforming electrical contracting through intelligent automation, component recognition, and real-time project management. This project follows the **BMAD Method (Breakthrough Method of Agile Development)** for AI-driven development workflows.

## BMAD Method Integration

This project implements the **BMAD Method V3 "Agent Preview"** for advanced AI-driven project management:

### Core BMAD Principles
- **Vibe CEO'ing**: Think like a CEO with unlimited resources and singular vision
- **AI as High-Powered Team**: Leverage specialized AI agents for different project phases  
- **Iterative Refinement**: Embrace non-linear development with continuous improvement
- **Quality Control**: Human oversight as ultimate arbiter of quality
- **Strategic Oversight**: Maintain high-level vision while agents handle execution

### BMAD Agent Orchestrator
The project uses the **IDE BMAD Orchestrator** (`bmad-agent/ide-bmad-orchestrator.md`) which can embody various specialist personas:

**Available Personas:**
- **Analyst (Larry)**: Research, brainstorming, requirements gathering
- **Product Manager (Jack)**: PRD creation, product planning
- **Architect (Mo)**: System architecture, technical design  
- **Design Architect (Millie)**: UI/UX specs, frontend architecture
- **Product Owner (Curly)**: Story management, backlog refinement
- **Scrum Master (SallySM)**: Technical scrum facilitation, story generation
- **Developer Agents**: Full-stack, frontend specialized implementation

**To activate BMAD Orchestrator:**
1. Load configuration from `bmad-agent/ide-bmad-orchestrator-cfg.md`
2. Choose persona: "Which persona shall I become, and what task should it perform?"
3. Agent embodies chosen persona and executes specified tasks

## Claude Code Best Practices

### 1. Workflow Strategy: Explore → Plan → Code → Commit

```bash
# 1. Explore codebase and understand context
find . -name "*.md" -o -name "*.json" -o -name "*.ts" -o -name "*.py" | head -20

# 2. Plan implementation using BMAD Method
# Activate appropriate BMAD persona for planning phase

# 3. Implement with focused development
# Use dev.ide.md persona for implementation

# 4. Commit with comprehensive messages following BMAD standards
git add . && git commit -m "Complete Story X.Y: [Feature Name]

[Detailed implementation description following BMAD DoD checklist]

🤖 Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 2. Test-Driven Development (TDD)

```bash
# Run tests before implementation
npm test                    # Frontend tests
pytest                     # Backend tests  
playwright test            # E2E tests

# Verify tests fail initially, then implement to pass
# Follow BMAD quality control principles
```

### 3. Project Structure & Navigation

**Key Directories:**
```
├── bmad-agent/              # BMAD Method configuration & personas
│   ├── personas/           # AI agent definitions
│   ├── tasks/              # Reusable task instructions  
│   ├── templates/          # Document templates
│   └── data/               # BMAD knowledge base
├── docs/                   # Project documentation & stories
│   ├── stories/            # BMAD user stories
│   └── task-summaries/     # Implementation summaries
├── src/                    # Source code
│   ├── backend/            # Python microservices
│   └── frontend/           # Next.js React application
├── tests/                  # Test suites
└── infra/                  # Infrastructure & deployment
```

**Critical Files to Review:**
- `docs/electrical-orchestrator-prd.md` - Product requirements
- `docs/electrical-orchestrator-architecture.md` - System architecture
- `docs/frontend-architecture.md` - Frontend architecture
- `bmad-agent/data/bmad-kb.md` - BMAD methodology knowledge base

### 4. Development Commands

```bash
# Development setup
./scripts/dev-setup.sh      # Initialize development environment
docker-compose up -d        # Start services

# Backend development
cd src/backend/services/[service-name]
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py

# Frontend development  
cd src/frontend
npm install
npm run dev

# Testing
./scripts/test.sh           # Run all tests
npm run test:coverage       # Test coverage
playwright test --ui        # E2E tests with UI
```

### 5. Code Style & Standards

**Python Backend:**
- **Framework**: FastAPI with async/await patterns
- **Database**: PostgreSQL with SQLAlchemy ORM, Redis for caching
- **Testing**: pytest with 95%+ coverage requirement
- **Linting**: Black formatting, flake8 standards
- **Documentation**: Comprehensive docstrings and type hints

**TypeScript Frontend:**
- **Framework**: Next.js 14 with App Router, React Server Components
- **Styling**: Tailwind CSS with component library
- **State**: Zustand for global state, React Query for server state
- **Testing**: Jest + React Testing Library, Playwright for E2E
- **Linting**: ESLint + Prettier with strict TypeScript configuration

**Security Standards:**
- Input validation and sanitization
- JWT token authentication with refresh rotation
- Rate limiting and CORS protection
- No hardcoded secrets, environment variable configuration
- Security scanning in CI/CD pipeline

### 6. Story Implementation Workflow (BMAD Method)

**Story Structure:**
Each story follows BMAD format in `docs/stories/[epic].[story].story.md`:

```markdown
# Story X.Y: [Title]
## Status: [Approved|In-Progress|Review|Done]
## Story
- As a [user type]
- I want [functionality]  
- so that [business value]

## Acceptance Criteria (ACs)
1. **Criterion 1**: Detailed requirement
2. **Criterion 2**: Detailed requirement

## Tasks / Subtasks
- [ ] **Task 1**: Implementation details
- [ ] **Task 2**: Implementation details

## Story Definition of Done (DoD) Checklist Report
[Comprehensive verification against BMAD DoD standards]
```

**Implementation Process:**
1. **Story Assignment**: Activate Developer Agent persona via BMAD Orchestrator
2. **Story Review**: Verify story status and load all reference documents
3. **Implementation**: Execute tasks following BMAD operational guidelines
4. **Testing**: Comprehensive test coverage per story ACs
5. **DoD Verification**: Complete BMAD checklist verification
6. **Handoff**: Update status to Review and present DoD report

### 7. Git Workflow & Commit Standards

**Branch Strategy:**
```bash
git checkout -b story-[epic]-[story]-[feature-name]
# Example: git checkout -b story-3-3-industrial-control-recognition
```

**Commit Message Format:**
```
[Story X.Y]: [Short Description]

[Detailed implementation notes]
- Key features implemented
- Technical decisions made  
- Tests added/modified
- Documentation updated

Follows BMAD DoD Checklist:
✅ Requirements Met
✅ Coding Standards  
✅ Testing Complete
✅ Documentation Updated

🤖 Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

### 8. Debugging & Issue Resolution

**Debugging Protocol (BMAD Method):**
1. **Log Issues**: Document in `TODO-revert.md` before applying debug code
2. **3-4 Cycle Rule**: If issue persists after 3-4 attempts, escalate
3. **Temporary Changes**: Must be reverted before story completion
4. **Status Updates**: Maintain debugging log with current status

**Common Debug Commands:**
```bash
# Backend debugging
docker logs [container-name]
python -m pdb main.py

# Frontend debugging  
npm run dev -- --debug
npm run build -- --analyze

# Database debugging
docker exec -it postgres psql -U username -d database_name
```

### 9. External Dependencies

**Pre-Approved Dependencies:**
- **Backend**: FastAPI, SQLAlchemy, Redis, PostgreSQL, TensorFlow, OpenCV
- **Frontend**: Next.js, React, Tailwind CSS, Zustand, React Query
- **Testing**: pytest, Jest, Playwright, React Testing Library
- **Infrastructure**: Docker, Kubernetes, AWS CDK

**New Dependency Protocol (BMAD):**
1. **HALT Implementation**: Stop work requiring new dependency
2. **Document Need**: Strong justification in story file
3. **Request Approval**: Explicit user approval required
4. **Document Approval**: Note approval in story file with date
5. **Proceed**: Only after explicit approval

### 10. Quality Control & Code Review

**BMAD Quality Control Standards:**
- **Human Oversight**: Developer as ultimate quality arbiter
- **Iterative Refinement**: Continuous improvement expected
- **Standards Adherence**: Strict operational guidelines compliance  
- **Test Coverage**: 95%+ coverage for critical paths
- **Documentation**: Comprehensive inline and user-facing docs

**Review Checklist:**
- [ ] All acceptance criteria met
- [ ] Code follows style guidelines
- [ ] Tests pass with adequate coverage
- [ ] No security vulnerabilities
- [ ] Documentation updated
- [ ] Performance requirements met
- [ ] BMAD DoD checklist complete

### 11. Error Handling & Logging

**Backend Error Handling:**
```python
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)

try:
    # Implementation
    result = await process_data()
    return result
except SpecificException as e:
    logger.error(f"Specific error in {__name__}: {e}")
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    logger.error(f"Unexpected error in {__name__}: {e}")
    raise HTTPException(status_code=500, detail="Internal server error")
```

**Frontend Error Handling:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

const { data, error, isLoading } = useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  onError: (error) => {
    console.error('Query error:', error);
    toast.error('Failed to load data');
  }
});
```

### 12. Environment Configuration

**Environment Variables:**
```bash
# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/electrical_orchestrator
REDIS_URL=redis://localhost:6379
JWT_SECRET_KEY=your-secret-key
OPENAI_API_KEY=your-openai-key

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

### 13. Performance & Optimization

**Backend Performance:**
- Async/await patterns for I/O operations
- Database query optimization with proper indexing
- Redis caching for frequently accessed data
- Connection pooling for database connections

**Frontend Performance:**
- Next.js Server Components for reduced client bundle
- Dynamic imports for code splitting
- Image optimization with Next.js Image component
- React Query for intelligent caching and background updates

### 14. Security Considerations

**Authentication & Authorization:**
- JWT tokens with automatic refresh
- Role-based access control (RBAC)
- Session management with secure cookies
- Rate limiting to prevent abuse

**Data Protection:**
- Input validation and sanitization
- SQL injection prevention via ORM
- XSS protection with Content Security Policy
- HTTPS enforcement in production

### 15. Deployment & Infrastructure

**Docker Development:**
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Rebuild service
docker-compose build [service-name]
```

**Production Deployment:**
- Kubernetes manifests in `infra/k8s/`
- AWS CDK infrastructure as code
- Automated CI/CD with GitHub Actions
- Health checks and monitoring

## AI Agent Collaboration Guidelines

### Working with Claude Code
1. **Be Specific**: Mention exact files and requirements
2. **Use Visual Context**: Screenshots for UI work when helpful
3. **Iterative Feedback**: Course correct early and often  
4. **Leverage Tools**: Use all available Claude Code tools effectively
5. **Multiple Instances**: Use parallel Claude instances for verification
6. **Stay Focused**: Use `/clear` to maintain context clarity

### BMAD Method with Claude Code
1. **Persona Activation**: Load appropriate BMAD persona for task type
2. **Task Execution**: Follow BMAD task instructions precisely  
3. **Quality Control**: Apply BMAD quality standards throughout
4. **Documentation**: Maintain BMAD story format and DoD requirements
5. **Handoff Process**: Follow BMAD completion and review workflow

## Common Fixes & Solutions Memory

### JSX Syntax Issues
**Problem**: TypeScript compiler errors with comparison operators in JSX text
**Error**: `TS1003: Identifier expected.` when using `<` or `>` in JSX text content
**Solution**: Escape comparison operators as HTML entities:
- `<` → `&lt;`
- `>` → `&gt;`
- `<=` → `&lt;=`
- `>=` → `&gt;=`
**Example**: Change `<span>Low (<70%)</span>` to `<span>Low (&lt;70%)</span>`

### TypeScript Path Mapping Issues
**Problem**: Module resolution errors with `@/` imports
**Error**: `Cannot find module '@/components/...'`
**Solution**: Ensure tsconfig.json has proper path mapping:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Development Server Refresh Requirements
**Problem**: Changes not reflecting in running application after file modifications
**Solution**: Always restart development servers after making changes:
- **Frontend**: Kill and restart `npm run dev` after TypeScript/component changes
- **Backend**: Restart Python services after model/API changes
- **Docker**: Use `docker-compose restart [service]` for containerized services
**Why**: Hot reload can miss certain changes like type definitions, new imports, or configuration updates

### Missing UI Components
**Problem**: Import errors for shadcn/ui components
**Error**: `Module '"@/components/ui/..."' has no exported member`
**Solution**: 
1. Check if component exists in `components/ui/`
2. Create missing components using shadcn CLI: `npx shadcn-ui@latest add [component]`
3. Verify export statements in component files

### WebSocket Connection Issues
**Problem**: Socket.io client connection failures
**Solution**: Ensure proper client configuration with fallback transports:
```typescript
const socket = io(url, {
  transports: ['websocket', 'polling'],
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: 5
});
```

### Fabric.js Performance Issues
**Problem**: Canvas lag with many objects
**Solution**: 
- Enable performance mode: `canvas.renderOnAddRemove = false`
- Use object caching: `object.cache()`
- Batch operations: `canvas.requestRenderAll()`
- Implement viewport culling for large datasets

### Zustand Store Type Safety
**Problem**: TypeScript errors with store actions
**Solution**: Ensure proper typing with state and actions separation:
```typescript
interface State {
  // state properties
}

interface Actions {
  // action methods
}

type Store = State & Actions;
```

### AI Training Data Workflow
**Pattern**: Symbol extraction from legend PDFs for ML training
**Implementation**: Multi-stage pipeline with visual extraction
**Key Components**:
1. `SymbolLegendExtractor` - UI workflow component
2. `symbolExtractionService` - API client with WebSocket support
3. `useSymbolExtraction` - React Query integration hook
**Workflow**: Upload PDF → Detect Symbols → OCR Text → Pair Symbol-Description → Verify → Export Training Data
**Best Practice**: Start ML training with legend sheets for clean, labeled examples

This configuration enables effective AI-assisted development while maintaining the structured, quality-focused approach of the BMAD Method. The combination provides both tactical development guidance and strategic project management framework.