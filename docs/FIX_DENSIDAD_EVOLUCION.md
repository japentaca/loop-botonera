# Fix: Evolution Cycle Density Calculation

## Problem

The "regenerar" button correctly calculated global density, but the evolution cycle generated too many notes due to incorrect density calculations.

## Root Cause

The evolution system in `audioStore.js` was calling `generateLoopPattern()` for loops but NOT applying the same global density calculation that the manual "Regenerar" button uses.

### Manual Regeneration (working correctly):
- Calls `generateLoopPattern()` for each active loop
- **Calls `applyDynamicDensities()`** after regeneration
- This recalculates auto densities based on global bias

### Evolution Cycle (broken):
- Calls `generateLoopPattern()` for selected loops  
- **Does NOT call `applyDynamicDensities()`**
- Uses outdated or incorrect density values
- Results in too many notes being generated

## Solution

Added `applyDynamicDensities()` call in the evolution system at line 652 in `src/stores/audioStore.js` to ensure the evolution cycle uses the same density calculation as manual regeneration.

### Changes Made:
1. **Added density recalculation**: `applyDynamicDensities()` call in evolution system
2. **Added debug logging**: Shows global bias and effective densities during evolution
3. **Fixed consistency**: Evolution now uses same density logic as manual regeneration

## Verification

The fix ensures:
- Evolution cycle now respects global density bias
- Auto-density loops get recalculated properly based on active loop count
- Consistent behavior between manual "regenerar" and automatic evolution
- Proper energy management during evolution cycles

This resolves the issue where evolution cycles were generating significantly more notes than the manual regeneration process.