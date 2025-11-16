# REFACTORING FOR AI AGENT - MODULAR MUSIC

## CRITICAL: EXECUTION RULES FOR THE AGENT

### ABSOLUTE RESTRICTIONS (VIOLATION = FAILURE)
1. **NEVER RENAME EXISTING FILES**
   - Always keep original names
   - New files: use descriptive names but do not change existing ones
   - Deprecated files: move to `src/deprecated/` without touching originals

2. **NO TEST AUTOMATION**
   - Do not use vitest, jest, or any framework
   - Testing = user performs manual tests with Chrome DevTools MCP
   - Verify functionality in a real browser

3. **MANDATORY VERIFICATIONS**
   - After EACH change: `npm run dev` must work
   - After EACH import: verify the file actually exists
   - After EACH function: check exports/imports match

4. **MAXIMUM ONE FILE PER SESSION**
   - Do not attempt to refactor multiple files
   - Complete and verify one before the next
   - Prioritize stability over speed

## QUICK ANALYSIS - CRITICAL PROBLEMS

### File: `src/composables/useMusic.js`
**Identified issues:**
- ❌ Defines scales + generates patterns + melodies + chords + quantization
- ❌ Mixed functions with no cohesion
- ❌ 300+ lines without separation of responsibilities

**Functions to extract (in priority order):**
1. `getScaleNotes()` - pure music theory
2. `quantizeToScale()` - quantization utility
3. `generateChordProgression()` - chord generation
4. `getPatternLengths()` - pattern constants

### File: `src/composables/useMelodicGenerator.js`
**Identified issues:**
- ❌ Generates melodies + handles counterpoint + selects patterns + regenerates loops
- ❌ Coupled to global `notesMatrix`
- ❌ Selection logic mixed with generation

## EXTRACTION PROTOCOL

### Step 1: Create auxiliary file (same folder)
```javascript
// src/composables/musicTheory.js
// EXTRACT: Only music theory functions

export const SCALES = { /* constants */ };
export const getScaleNotes = (scaleName) => { /* logic */ };
export const getChordNotes = (chordType) => { /* logic */ };
```

### Step 2: Update original (preserve imports)
```javascript
// src/composables/useMusic.js
import { SCALES, getScaleNotes, getChordNotes } from './musicTheory.js'

// KEEP: Export functions for compatibility
export { SCALES, getScaleNotes, getChordNotes }
```

### Step 3: Verify (CRITICAL)
1. Chrome DevTools: does the app load without errors?
2. Does musical generation work the same?
3. No errors in console?

## VERIFICATION CHECKLIST

### Before changing code:
- [ ] Read the complete current file
- [ ] Identify functions to extract
- [ ] Verify the new file does not exist

### During extraction:
- [ ] Copy functions exactly (without changing)
- [ ] Keep original exports in the old file
- [ ] Verify imports match actual files
- [ ] NOTE: Vite HMR updates automatically, do not restart the server

### After extraction:
- [ ] Verify HMR updates automatically (Vite does not need restart)
- [ ] Chrome DevTools: no import errors
- [ ] Musical functionality: test generation
- [ ] Console: no undefined/import errors

## PROPOSED SEQUENCE

### Session 1: Extract music theory from useMusic.js
1. Create `src/composables/musicTheory.js`
2. Move only scale/chord functions
3. Verify full functionality

### Session 2: Extract utilities from useMusic.js  
1. Create `src/composables/musicUtils.js`
2. Move quantization and validations
3. Verify full functionality

### Session 3: Improve useMelodicGenerator.js
1. Extract pattern selection logic
2. Separate generation from orchestration
3. Verify musical loop generation

## COMMON ERROR MESSAGES

### "Cannot find module"
- ERROR: Import points to a non-existent file
- SOLUTION: Verify exact path, capitalization, `.js`

### "export not found"
- ERROR: Function not exported from the file
- SOLUTION: Add it to the file’s exports

### "undefined is not a function"
- ERROR: Circular or incorrect import
- SOLUTION: Verify exports/imports match exactly

## IMPORTANT TECHNICAL NOTES

### VITE HMR (Hot Module Replacement)
- **DO NOT RESTART** the server during development
- Changes apply automatically on save
- If errors occur, fix and save again
- Only restart if the error persists after 10 seconds

### QUICK VERIFICATION WITH HMR
1. Save changes in the file
2. Wait 2–3 seconds
3. Check in Chrome DevTools: Network tab
4. Look for successful "hmr" requests
5. If HMR fails: correct the error and save

## FINAL REMINDER

**SIMPLE > PERFECT**: Better a small change that works than a big plan that fails.

**VERIFY > ASSUME**: If you cannot verify, do not make the change.

**WORKING > REFACTORED**: Working code is always better than broken code.

**HMR > RESTART**: Vite updates automatically; do not interrupt the development flow.

---

**STATUS**: Ready to execute Session 1
**NEXT STEP**: Extract music theory from useMusic.js → musicTheory.js
