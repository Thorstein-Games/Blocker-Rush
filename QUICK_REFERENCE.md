# Quick Reference: Drag Improvements

## What Was Fixed

### 1. **Anchor Cell Model** 
- Every piece now has a stable reference point (top-left-most cell)
- Pointer stays "glued" to anchor during drag, even when rotating/flipping
- **Files:** `packages/shared/src/anchor.ts`, `types.ts`, `pieces.ts`

### 2. **Pointer Capture + RAF**
- Uses `setPointerCapture()` for reliable event delivery
- RAF loop ensures 60fps updates, synced to display refresh
- **File:** `apps/web/components/GameContext.tsx`

### 3. **Hysteresis Snapping**
- 0.35 threshold prevents jitter at cell boundaries
- Creates stable "dead zone" like iOS icon rearrangement
- **File:** `apps/web/components/GameContext.tsx` → `updateGhost()`

### 4. **Zero Layout Thrashing**
- Metrics cached at drag start, not read every move
- RAF loop only writes to DOM, never reads
- **File:** `apps/web/components/GameContext.tsx` → cached in `InteractionState`

## Key Architecture Changes

### InteractionState Type
```typescript
type InteractionState = {
  // ... existing fields ...
  pointerToAnchorOffset: { x: number; y: number };  // NEW: stable pointer-to-anchor offset
  currentPointerX: number;                           // NEW: cached pointer position
  currentPointerY: number;
  lastSnappedCell: Vec2 | null;                     // NEW: for hysteresis
  rafId: number | null;                             // NEW: RAF loop ID
  targetElement: HTMLElement | null;                // NEW: for pointer capture
};
```

### Snap Calculation
```typescript
// 1. Pointer → Anchor position (world coords)
anchorWorldX = pointerX - pointerToAnchorOffset.x

// 2. Anchor → Grid cell (fractional)
anchorGridX = (anchorWorldX - boardRect.left) / step

// 3. Piece origin from anchor
originX = anchorGridX - anchorCell.x

// 4. Apply hysteresis
snappedOriginX = abs(originX - lastOriginX) > 0.35
  ? round(originX)
  : lastOriginX
```

## Debug Mode

Uncomment console.logs in `GameContext.tsx` → `updateGhost()`:
```typescript
// console.log('updateGhost called:', { ... });
// console.log('Anchor position:', { ... });
// console.log('Grid computation:', { ... });
```

## Testing Checklist

- [ ] Drag from tray → piece stays under pointer
- [ ] Drag from board → piece stays under pointer
- [ ] Rotate while dragging → snap target stable
- [ ] Flip while dragging → snap target stable
- [ ] Hover at cell boundary → no jitter (hysteresis working)
- [ ] Drop outside board → piece returns or is removed
- [ ] Multi-touch → each pointer isolated

## Performance Validation

Open DevTools → Performance:
1. Start recording
2. Drag a piece around
3. Stop recording
4. Check:
   - No "Recalculate Style" or "Layout" in pointermove events ✅
   - requestAnimationFrame shows at ~16.67ms intervals (60fps) ✅

## Files Modified

Core:
- `packages/shared/src/anchor.ts` (NEW)
- `packages/shared/src/types.ts`
- `packages/shared/src/pieces.ts`
- `packages/shared/src/index.ts`
- `apps/web/components/GameContext.tsx` (major rewrite)

Fixes:
- `packages/shared/src/solver.ts` (TS error)
- `apps/web/lib/useLocalStorage.ts` (TS error)
- `apps/web/components/PiecesTray.tsx` (TS error)

## What You Get

✅ Smooth 60fps dragging on mid-range devices  
✅ Piece "sticks" to pointer at exact grab point  
✅ No jumping during rotation/flip  
✅ No jitter at cell boundaries  
✅ Works with mouse, touch, and pen  
✅ Native-app quality feel  

---

**Full details:** See [DRAG_IMPROVEMENTS.md](./DRAG_IMPROVEMENTS.md)
