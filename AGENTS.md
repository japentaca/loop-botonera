- don´t start development server, it uses HRM
- don't run eslint or else, just check if  changes are ok
- don't run deffensive code, I prefer an error and try to fix the root cause.
 - ask permission before taking the decision of installing NPM packages
 - maintain repository documentation in sync after making changes (update docs, not separate reports)
 - do NOT write reports for changes made; just update the related docs and the code
 - if the agent has questions, ask them one-by-one to the user
 - always prefer pure vanilla JavaScript for implementation of new modules and utilities
 - avoid use of Vue reactivity inside modules where possible (wrap reactivity at store/UI boundaries only)
 - Frontend tests can be made using Chrome devtools MCP by opening  http://localhost:5173/

## Architecture & Patterns

### Tech Stack
- **Framework**: Vue 3 + Vite
- **State Management**: Pinia
- **UI Library**: PrimeVue (Aura theme)
- **Audio Engine**: Tone.js
- **Styling**: Vanilla CSS + PrimeVue themes

### Directory Structure
- `src/core`: Pure JavaScript business logic. Independent of Vue/Pinia.
- `src/modules`: Specialized functional modules (e.g., `tonalCycles`, `audioEngine`). These contain the core logic of the application.
- `src/stores`: Pinia stores. `audioStore.js` is the central hub that coordinates modules (`loopManager`, `energyManager`, etc.) and manages global state.
- `src/composables`: Vue composables for reactive logic reuse.
- `tests/integration`: Integration tests for core logic.

### Key Design Patterns
1.  **Vanilla JS Core**: The application logic favors pure Vanilla JS implementation in `src/modules` and `src/core`.
2.  **Reactivity Boundary**: Vue/Pinia reactivity is kept at the boundaries (stores and components). Modules should ideally be non-reactive classes or functions.
3.  **Centralized Audio Store**: `audioStore` initializes and coordinates the audio engine and sub-modules. It handles the "glue" between the reactive UI and the imperative audio logic.
4.  **Loop Management**: `loopManager` handles the lifecycle of audio loops, while `notesMatrix` (composable) handles the musical data (notes, patterns).

### Deep Dive: Critical Implementation Details

#### 1. Persistence Strategy (PresetStore)
- **Snapshot Approach**: State is saved via `captureCurrentState`, which gathers data from `audioStore` and `useNotesMatrix`.
- **Batch Mode**: Complex operations (like auto-evolution) use `startBatchMode()` and `endBatchMode()` to pause auto-saving and prevent write thrashing.

#### 2. Data Flow & Truth
- **Single Source of Truth**: `useNotesMatrix` (composable) holds the raw musical data (notes, patterns) and metadata.
- **Coordination**: `audioStore` acts as the central hub, coordinating between the UI, the audio engine, and the data layer.

#### 3. Evolution System (Delegation Pattern)
- **Intent-Based**: The `evolutionSystem` does NOT modify state directly. It analyzes the state and proposes "Intents" (e.g., `regenerate`, `mutate`).
- **Delegated Execution**: `audioStore` receives these intents and delegates execution to `melodicGenerator` or `notesMatrix` to ensure consistency.

#### 4. Performance Optimization
- **Shallow Reactivity**: Loops are stored using `shallowRef` to avoid deep reactivity overhead on large arrays.
- **Active Loop Cache**: `audioStore` maintains a cache of active loop indices to avoid filtering the loop array on every scheduler tick (16x/sec).

### Testing
- **Integration Tests**: Located in `tests/integration`. Run via `npm run test:integration`.
- **Frontend Verification**: Use Chrome DevTools MCP to verify UI at `http://localhost:5173/`.

### Recent UI tweaks
- **Header layout**: The `AppHeader` layout has been improved to provide a centered title, balanced left/right controls and better responsive behavior (desktop grid + mobile stacking). This fixes misalignment and inconsistent spacing.

- **Header overflow fix (mobile)**: Limit header height and enable vertical scrolling for `.header-row-main` and `.main-controls-left/right` on small screens. This prevents the header from growing excessively tall after initializing audio when many control groups are visible.