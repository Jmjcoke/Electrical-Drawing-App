# Source Tree Structure

## Project Overview
```
electrical-drawing-app/
├── frontend/                   # React TypeScript application
├── backend/                    # Node.js microservices
├── shared/                     # Shared types and utilities
├── infrastructure/             # Deployment and DevOps
├── docs/                       # Documentation
└── tools/                      # Development tools
```

## Frontend Structure (React + TypeScript)
```
frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── upload/
│   │   │   ├── FileUpload.tsx
│   │   │   ├── FilePreview.tsx
│   │   │   └── ProgressIndicator.tsx
│   │   ├── analysis/
│   │   │   ├── QueryInterface.tsx
│   │   │   ├── ResponseDisplay.tsx
│   │   │   └── ModelComparison.tsx
│   │   ├── schematic/
│   │   │   ├── SchematicViewer.tsx
│   │   │   └── ComponentHighlight.tsx
│   │   └── common/
│   │       ├── ErrorBoundary.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── Toast.tsx
│   ├── services/
│   │   ├── api.ts               # API client
│   │   ├── websocket.ts         # WebSocket client
│   │   └── pdf.ts               # PDF processing
│   ├── hooks/
│   │   ├── useFileUpload.ts     # File upload hook
│   │   ├── useAnalysis.ts       # Analysis management
│   │   └── useWebSocket.ts      # WebSocket connection
│   ├── types/
│   │   ├── api.ts               # API type definitions
│   │   ├── analysis.ts          # Analysis data types
│   │   └── components.ts        # Component prop types
│   ├── utils/
│   │   ├── validation.ts        # Input validation
│   │   ├── formatting.ts        # Data formatting
│   │   └── constants.ts         # Application constants
│   ├── styles/
│   │   ├── globals.css
│   │   └── theme.ts             # Material-UI theme
│   ├── App.tsx
│   └── index.tsx
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

## Backend Structure (Microservices)
```
backend/
├── services/
│   ├── file-processor/          # File upload and processing service
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   │   ├── upload.controller.ts
│   │   │   │   └── document.controller.ts
│   │   │   ├── services/
│   │   │   │   ├── file.service.ts
│   │   │   │   ├── pdf.service.ts
│   │   │   │   └── storage.service.ts
│   │   │   ├── utils/
│   │   │   │   ├── validation.ts
│   │   │   │   └── conversion.ts
│   │   │   ├── routes/
│   │   │   │   └── index.ts
│   │   │   └── app.ts
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── llm-orchestrator/        # LLM provider management
│   │   ├── src/
│   │   │   ├── providers/
│   │   │   │   ├── openai.provider.ts
│   │   │   │   ├── claude.provider.ts
│   │   │   │   ├── gemini.provider.ts
│   │   │   │   └── local.provider.ts
│   │   │   ├── ensemble/
│   │   │   │   ├── orchestrator.ts
│   │   │   │   └── load-balancer.ts
│   │   │   ├── consensus/
│   │   │   │   ├── aggregator.ts
│   │   │   │   └── confidence.ts
│   │   │   ├── controllers/
│   │   │   │   └── analysis.controller.ts
│   │   │   └── app.ts
│   │   ├── config/
│   │   │   ├── models.json
│   │   │   └── prompts.json
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── response-aggregator/     # Response processing and consensus
│   │   ├── src/
│   │   │   ├── aggregation/
│   │   │   │   ├── consensus.service.ts
│   │   │   │   └── ranking.service.ts
│   │   │   ├── ranking/
│   │   │   │   ├── confidence.calculator.ts
│   │   │   │   └── quality.scorer.ts
│   │   │   ├── confidence/
│   │   │   │   ├── ensemble.confidence.ts
│   │   │   │   └── statistical.confidence.ts
│   │   │   ├── controllers/
│   │   │   │   └── aggregation.controller.ts
│   │   │   └── app.ts
│   │   ├── algorithms/
│   │   │   ├── voting.ts
│   │   │   └── weighted-average.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   └── session-manager/         # Session and caching service
│       ├── src/
│       │   ├── session/
│       │   │   ├── session.service.ts
│       │   │   └── cleanup.service.ts
│       │   ├── cache/
│       │   │   ├── redis.service.ts
│       │   │   └── memory.cache.ts
│       │   ├── cleanup/
│       │   │   ├── scheduler.ts
│       │   │   └── garbage-collector.ts
│       │   ├── controllers/
│       │   │   └── session.controller.ts
│       │   └── app.ts
│       ├── policies/
│       │   ├── retention.policy.ts
│       │   └── expiration.policy.ts
│       ├── Dockerfile
│       └── package.json
├── shared/                      # Shared libraries
│   ├── types/
│   │   ├── api.types.ts
│   │   ├── analysis.types.ts
│   │   ├── session.types.ts
│   │   └── common.types.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── config.ts
│   │   ├── validation.ts
│   │   └── errors.ts
│   ├── config/
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   └── llm-providers.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── cors.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   └── error.middleware.ts
│   ├── package.json
│   └── tsconfig.json
└── infrastructure/              # DevOps and deployment
    ├── kubernetes/
    │   ├── namespace.yaml
    │   ├── configmaps/
    │   ├── secrets/
    │   ├── deployments/
    │   ├── services/
    │   └── ingress/
    ├── docker/
    │   ├── docker-compose.yml
    │   ├── docker-compose.dev.yml
    │   └── Dockerfile.production
    └── monitoring/
        ├── prometheus/
        ├── grafana/
        └── elasticsearch/
```

## Database Structure
```
database/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_add_indexes.sql
│   └── 003_add_analytics.sql
├── seeds/
│   ├── test_data.sql
│   └── sample_sessions.sql
├── schemas/
│   ├── electrical_analysis.sql
│   └── analytics.sql
└── backup/
    └── .gitkeep
```

## Documentation Structure
```
docs/
├── architecture/                # Architecture documentation
│   ├── index.md                # Overview and table of contents
│   ├── tech-stack.md           # Technology stack details
│   ├── data-models.md          # Data models and schemas
│   ├── coding-standards.md     # Development standards
│   ├── testing-strategy.md     # Testing approach
│   ├── source-tree.md          # This file
│   ├── 1-executive-summary.md
│   ├── 2-high-level-system-architecture.md
│   ├── 3-detailed-component-architecture.md
│   ├── 4-data-flow-and-processing-pipelines.md
│   ├── 5-api-specifications-and-integration-patterns.md
│   ├── 6-deployment-architecture-and-infrastructure.md
│   ├── 7-security-architecture-and-compliance-framework.md
│   ├── 8-monitoring-and-observability-strategy.md
│   ├── 9-performance-and-scalability-considerations.md
│   ├── 10-implementation-roadmap.md
│   ├── 11-technical-decision-rationale.md
│   └── 12-appendices.md
├── api/                        # API documentation
│   ├── openapi.yaml
│   ├── endpoints.md
│   └── authentication.md
├── deployment/                 # Deployment guides
│   ├── local-development.md
│   ├── staging-deployment.md
│   └── production-deployment.md
└── user/                       # User documentation
    ├── getting-started.md
    └── troubleshooting.md
```

## Development Tools
```
tools/
├── scripts/
│   ├── setup.sh               # Development setup script
│   ├── build.sh               # Build script
│   ├── test.sh                # Test runner script
│   └── deploy.sh              # Deployment script
├── database/
│   ├── migrate.js             # Database migration tool
│   ├── seed.js                # Data seeding tool
│   └── backup.js              # Backup utility
├── monitoring/
│   ├── health-check.js        # Health monitoring
│   └── metrics-collector.js   # Custom metrics
└── ci-cd/
    ├── github-actions/
    │   ├── test.yml
    │   ├── build.yml
    │   └── deploy.yml
    └── quality-gates/
        ├── eslint.config.js
        ├── prettier.config.js
        └── husky.config.js
```

## Configuration Files
```
Root Level Configuration:
├── .gitignore                  # Git ignore patterns
├── .env.example                # Environment template
├── .eslintrc.js               # ESLint configuration
├── .prettierrc                # Prettier configuration
├── package.json               # Root package.json (workspaces)
├── tsconfig.json              # Root TypeScript config
├── docker-compose.yml         # Local development environment
├── README.md                  # Project documentation
└── LICENSE                    # Project license
```

## Key File Descriptions

### Frontend Key Files
- **src/App.tsx**: Main application component with routing
- **src/services/api.ts**: Centralized API client with type safety
- **src/hooks/useAnalysis.ts**: Custom hook for analysis state management
- **src/components/schematic/SchematicViewer.tsx**: PDF/schematic rendering component

### Backend Key Files
- **services/llm-orchestrator/src/ensemble/orchestrator.ts**: Main LLM coordination logic
- **services/response-aggregator/src/aggregation/consensus.service.ts**: Response consensus algorithm
- **shared/middleware/error.middleware.ts**: Centralized error handling
- **shared/types/**: TypeScript definitions shared across services

### Infrastructure Files
- **infrastructure/kubernetes/**: Kubernetes deployment manifests
- **infrastructure/docker/docker-compose.yml**: Multi-service local development
- **tools/scripts/setup.sh**: One-command development environment setup

## Development Workflow Integration

### IDE Configuration
- VSCode workspace configuration in `.vscode/`
- TypeScript project references for optimal IDE performance
- ESLint and Prettier integration
- Debug configurations for frontend and backend

### Build System
- Lerna/Rush for monorepo management
- TypeScript project references for incremental builds
- Docker multi-stage builds for production optimization
- Webpack/Vite for frontend bundling

### Testing Structure
- Unit tests co-located with source files (`*.test.ts`)
- Integration tests in dedicated `__tests__` directories
- E2E tests in separate `e2e/` directories
- Shared test utilities in `shared/test-utils/`