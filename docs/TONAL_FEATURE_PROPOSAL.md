# Tonal Integration & Stochastic Multi-Voice Proposal

Purpose
-------
This document describes a machine-consumable proposal to extend the project with the following features:
- Multi-voice structures (grouped loops / per-loop voices)
- Tonal-aware counterpoint rules (avoid perfect parallels, prefer contrary motion, voice-leading rules)
- Tonal cycles and mutations (key/mode cycles, degree-based mutation)
- Stochastic generators (Markov degree generator, chord-aware voice assignment)

The document is intentionally explicit: it lists the exact file edits, tests with MCP Chrome DevTools, branch/commit pattern, and the set of starter questions an agent must ask when the user opens a new chat session with this file attached.

Constraints & Safety
---------------------
- Do not run the dev server ("vite" or "npm run dev") unless explicitly asked.
- Ask for permission before installing any NPM package (e.g., Tonal modules). Documentation and code will rely on Tonal only after explicit approval.
- Avoid running linters or automatic code fixes. Please keep code changes simple and reviewable.
- Prefer vanilla JavaScript files for new modules. Limit framework-specific changes to composables/stores to minimize reactivity issues.
- Use `notesMatrix` getters/setters and `useMelodicGenerator` integration points; do not mutate store metadata directly.

Scope & Goals
--------------
- Add polyphonic/multi-voice support via group-linked loops to preserve the existing per-loop model.
- Improve counterpoint by adding Tonal-based interval analysis and voice-leading rules.
- Provide tonal cycle capabilities: automatic mode/key rotation, or per-loop tonal mutators activated on cycles.
- Add generative utilities: Markov-degree pattern generator and chord-based voice assignment.
- Keep features opt-in via metadata toggles and `audioStore` settings.

Primary Tasks (Top-level)
-------------------------
1. Add dependency placeholders and ask for permission to install Tanol modules.
2. Implement minimal multi-voice group logic and a `voiceGenerators` module.
3. Upgrade `counterpointService` to incorporate Tonal interval detection and rules.
4. Add `tonalCycles` module for cycle-based scale & key mutation.
5. Add `markovGenerators` and `chordGenerators` modules.
6. Add simple tests and MCP Chrome DevTools pages for interactive validation.
7. Update documentation and `AGENT_PROGRESS.md`.

Files To Create / Edit (Exact Paths)
------------------------------------
- src/utils/voiceGenerators.js  (new)
- src/utils/markovGenerators.js  (new)
- src/utils/chordGenerators.js  (new)
- src/modules/tonalCycles.js  (new)
- src/services/counterpointService.js  (update)
- src/composables/useMelodicGenerator.js  (update)
- src/composables/useNotesMatrix.js  (update metadata: `voiceGroupId`, helper APIs)
- src/utils/patternGenerators.js  (optional update to support degree-based Markov)
- docs/AGENT_PROGRESS.md  (create/update)  (progress tracking)
- docs/TONAL_FEATURE_PROPOSAL.md  (the current document)

Schematics for Changes
----------------------
- `loopMetadata` updates:
  - Add: `voiceGroupId: null` and minimal voice config template:
    ```js
    voiceGroupId: null,
    voiceConfig: [{offset:0, role:'melody'}, {offset:-12, role:'bass'}],
    voicesEnabled: false
    ```
- Group linking helper in `useNotesMatrix`:
  - `linkLoopsAsVoices(masterLoopId, [loopIds])`
  - `getGroupMembers(groupId)`
- Generator entry points:
  - `generateVoicedGroupPattern(groupId, options)` in `src/utils/voiceGenerators.js`
  - This function will call existing pattern generators but with per-voice overrides (density, baseNote offset, generator preference)

Tonal Usage (modular imports recommended)
-----------------------------------------
- Required Tonal modules:
  - `@tonaljs/note` - Note name/midi conversion
  - `@tonaljs/midi` - midi/frequency func (if needed)
  - `@tonaljs/interval` - compute semitone distances and intervals
  - `@tonaljs/distance` - compute interval labels between notes
  - `@tonaljs/scale` - generate scale notes and intervals
  - `@tonaljs/chord` - chord analysis & chord-to-note lists

These modular packages are preferred over full `@tonaljs/tonal` to reduce bundle size.

Counterpoint Rules (Example)
----------------------------
- Avoid parallel perfect consonances (P5, P8) between voice pairs.
- Prefer contrary motion between adjacent time steps: compare delta of both voices.
- No hidden perfects into a perfect consonance: hidden direct perfects are forbidden when approached by leap.
- Allow passing and neighbor dissonances optionally (config toggle).
- Provide a `rules` configuration object in `counterpointService` for tests and staging.

Stochastic heuristics
---------------------
- Markov on scale degrees (N states for the number of notes in current scale) rather than raw MIDI values.
  - Build per-loop transitions and seed them with history or heuristic templates.
- Chord-aware assignment: given chord progression, pick chord tones per voice using weighted options.
- Generate Markov states from generated sequence (train or seeded templates); store them as metadata in `loopMetadata`.

Tonal Cycles & Mutation
-----------------------
- Implement `tonalCycles` to:
  - Rotate by modes: Ionian -> Dorian -> Phrygian -> Lydian -> Mixolydian -> Aeolian -> Locrian
  - Change root note by semitone or by scale degree every N cycles
  - Provide API: `startCycle({scope: 'global'|'group'|'loop', intervalBeats: 4, strategy: 'rotateMode'|'shiftKey'})`
- On cycle triggers, either `audioStore.updateScale` or call `notesMatrix.quantizeLoop` / `regenerateLoop` as appropriate depending on `generationMode`.

Testing Strategy - Automated + MCP DevTools
------------------------------------------
1. Node tests (pure functions)
   - Write `tests/integration/*_harness.js` to validate helper functions: note->name, interval detection, markov generator behavior.
   - Run `node tests/integration/*.js` for each new util file.
   - Do not run `npm run dev`.

2. MCP Chrome DevTools (interactive tests)
   - Create lightweight HTML files in `tests/pages/` that import the built code or a small bootstrap script using the repository's modules (prefers ESM import of built library in `dist/` if built — else make them self-contained scripts).
   - Use the MCP Chrome DevTools flows to open test pages, capture console messages, ensure that events occur, and verify reactivity and sequence results.
   - Check audio synth: Tone.js is already present; playback tests optional but allowed as long as UI test harness is not run with dev server.

3. Acceptance Criteria for each feature:
   - Multi-voice: Grouped loops generate per-voice patterns with assigned offsets and preserved reactivity (set via `notesMatrix.setLoopNotes`).
   - Counterpoint: No two voices show parallel P5/P8 in unit tests and logs show `applyCounterpoint` adjustments.
   - Tonal cycles: `audioStore.currentScale` changes at the configured interval and loops re-quantize/regenerate as requested.
   - Markov: Markov-degree generator produces repeatable sequences with expected degree mapping.

Progress Tracking Format
------------------------
- Create or update `docs/AGENT_PROGRESS.md` with JSON lines per task:
  - Example (append-only, but updated per changes):
    ```json
    {"id":"1", "task":"add_voice_group", "status":"completed", "startedAt":"2025-11-16T00:00:00Z", "completedAt":"2025-11-16T00:15:00Z", "notes":"Initial working PoC" }
    ```

Session Starter Questions (to ask on fresh chat sessions)
--------------------------------------------------------
- Permission to install Tonal modules? (Yes/No) — If yes, ask which modules (modular suggestions given in doc)
- Which feature to prioritize: (multi-voice | counterpoint | tonal cycles | markov/chord generator)?
- Should generated features be toggleable per loop or globally? (per-loop recommended)
- Are UI changes allowed? (yes/no) — the agent will prefer minimal UI changes
- Should the dev agent run a build (`npm run build`) to serve test pages for MCP tests? (Yes/No) — agent must not run `npm run dev` automatically
- Are there constraints on bundle size? (e.g., prefer modular Tonal usage vs aggregate `@tonaljs/tonal`]

Branching & Commit Guidelines
-----------------------------
- Branch: `feat/tonal-ml-voices` (or similar)
- Small commits: break down by module with clear commit names (see commit naming guidelines above in this doc)
- Provide low-level tests for each small change and update `docs/AGENT_PROGRESS.md` after each task

Agent Execution Checklist
------------------------
For each small task in the sequence, the agent should:
1. Update `docs/AGENT_PROGRESS.md` and create a new entry with `status:"in-progress"` and timestamp.
2. Create or edit files as specified with minimal, reversible changes.
3. Run Node tests (scripts under `tests/integration`). Update test harnesses or create new ones if required.
4. Build if necessary and run the MCP Chrome DevTools checks using `mcp_chromedevtool_*` commands.
5. Update `docs/AGENT_PROGRESS.md` with `status:"completed"` and add any failure notes.
6. Commit and push the feature branch as `feat/tonal-ml-voices`.

Acceptance Criteria & Exit Conditions
------------------------------------
After completing the feature, the agent must provide:
- A `docs/AGENT_PROGRESS.md` log updated with final entries
- Tests in `tests/integration` that validate the core functions
- Light MCP test pages in `tests/pages` used during development (optional for reading by humans, required for agent checks)
- Add `docs/TONAL_FEATURE_PROPOSAL.md` as a final documentation step

Example Minimal Implementation Plan (first 3 steps)
---------------------------------------------------
1. PoC: Minimal 'group/voice' linking (small file edits, no Tonal required)
  - Add `voiceGroupId` in `useNotesMatrix` default metadata and helper API
  - Add `voiceGenerators.js` with a `generateVoicedGroupPattern` that calls `generateRandomPattern` for each voice
  - Tests: Unit test to verify two linked loops produce adjacent notes and logging
2. Counterpoint: Tonal-based rules (requires permission)
  - Update `counterpointService.js` to import Tonal modules and compute intervals
  - Add a `isParallelP5` function and unit test
3. Tonal cycles: implement and test rotation of modes
  - Create `tonalCycles.js` with simple rotate cycle triggered via function. Update `audioStore.updateScale` usage and create test page

---

If this looks good, the agent should ask the STARTER QUESTIONS above and proceed based on responses. 

**Important:** The agent must not install packages without explicit permission and must follow repo agents instructions in `AGENTS.md`.

---

Appendix: Quick API Example Snippets (Machine-friendly)
------------------------------------------------------
- Convert midi -> note: `Note.fromMidi(60) // 'C4'`
- Interval: `Distance.interval('C4','G4') // 'P5'`
- Chord notes: `Chord.get('Cmaj7').notes // ['C','E','G','B']`
- Map scale-degree -> MIDI: `Note.midi(scale.notes[degree] + octave)`

End of Proposal
