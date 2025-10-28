# Authentication Application

## Overview

This is a React-based authentication application with a professional, modern design system. The application provides user signup and login functionality with a focus on clean UI, security perception, and user experience. Built with TypeScript, it features a full-stack architecture using Express.js for the backend and React with Vite for the frontend, styled with Tailwind CSS and shadcn/ui components.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tools**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server for fast hot module replacement
- **Wouter** for lightweight client-side routing (signup, login pages)

**State Management & Data Fetching**
- **TanStack Query (React Query)** for server state management, caching, and API calls
- **React Hook Form** with Zod validation for form state and validation
- Custom query client configured with credentials-based requests and infinite stale time

**UI Component System**
- **shadcn/ui** component library (New York style variant) with extensive Radix UI primitives
- **Tailwind CSS** for utility-first styling with custom design tokens
- **class-variance-authority (CVA)** for variant-based component styling
- Theme system supporting light and dark modes via CSS variables

**Design System**
- Professional SaaS-inspired design (Linear, Vercel, Stripe patterns)
- Custom color palette with semantic tokens (primary, secondary, destructive, muted, accent)
- Typography using 'Inter' font family with systematic size hierarchy
- Consistent spacing primitives (2, 4, 6, 8 unit scale)
- Form validation with visual feedback (password strength indicators, error messages)

### Backend Architecture

**Server Framework**
- **Express.js** with TypeScript for REST API endpoints
- Session-based request logging middleware with JSON response capture
- Development-only Vite integration for SSR and HMR
- Production build using esbuild for optimized bundling

**Storage Layer**
- **Abstracted storage interface (IStorage)** defining CRUD operations for users
- **In-memory implementation (MemStorage)** as the default storage mechanism using Maps
- Prepared for database integration via Drizzle ORM configuration
- UUID-based user identification using Node's crypto module

**Data Validation**
- **Zod schemas** shared between client and server for type-safe validation
- Schemas for user insertion, login credentials, with field-level validation rules
- Integration with Drizzle for database schema generation

### Database Schema

**User Table Structure**
- `id`: UUID primary key with auto-generation
- `fullName`: Text field (required)
- `email`: Text field (required, unique)
- `password`: Text field (required)

**ORM Configuration**
- **Drizzle ORM** configured for PostgreSQL dialect
- Migration output directory: `./migrations`
- Schema definition in shared directory for client-server reuse

### Authentication & Security

**Current Implementation**
- Form-based authentication with client-side validation
- Password requirements: minimum 8 characters
- Email format validation
- Password strength calculator (length, case mix, numbers, special characters)
- Visual password visibility toggle

**Session Management**
- Credential-based fetch requests configured in query client
- Prepared for session middleware integration (connect-pg-simple dependency present)

### External Dependencies

**Core UI Libraries**
- **Radix UI primitives** (22+ component packages) for accessible, unstyled components
- **Lucide React** for icon system
- **date-fns** for date manipulation
- **embla-carousel-react** for carousel functionality
- **vaul** for drawer/sheet components
- **cmdk** for command palette functionality

**Development Tools**
- **Vite plugins**: Runtime error modal, Cartographer (Replit-specific), dev banner
- **TypeScript** with strict mode and path aliases
- **PostCSS** with Tailwind and Autoprefixer
- **drizzle-kit** for database migrations and schema management

**Database & ORM**
- **@neondatabase/serverless** for serverless PostgreSQL connections
- **drizzle-orm** and **drizzle-zod** for type-safe database operations
- **connect-pg-simple** for PostgreSQL session store

**Form & Validation**
- **react-hook-form** for performant form state management
- **@hookform/resolvers** for Zod schema integration
- **zod** for runtime type validation

**Styling Utilities**
- **tailwindcss** with custom configuration
- **clsx** and **tailwind-merge** for conditional class merging
- **class-variance-authority** for component variants

### API Structure

**Current Routes**
- All API routes prefixed with `/api`
- Route registration occurs in `server/routes.ts` via `registerRoutes` function
- HTTP server creation integrated with Express app
- Request/response logging for API endpoints (truncated at 80 characters)

**Storage Interface Methods**
- `getUser(id)`: Retrieve user by ID
- `getUserByUsername(username)`: Retrieve user by username
- `createUser(user)`: Create new user with auto-generated UUID

### Build & Deployment

**Development Mode**
- `npm run dev`: Runs server with Vite middleware for HMR and SSR
- TypeScript execution via `tsx`
- Environment: `NODE_ENV=development`

**Production Build**
- Frontend: Vite build to `dist/public`
- Backend: esbuild bundle to `dist/index.js` (ESM format, external packages)
- Start command: `NODE_ENV=production node dist/index.js`

**Type Checking**
- `npm run check`: TypeScript compilation check without emission
- Incremental builds with tsBuildInfo caching

**Database**
- `npm run db:push`: Push Drizzle schema changes to database