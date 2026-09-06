// Operators with identical simulated effects are interchangeable within an axis.
// Keep every candidate and tie-breaker; reuse only the evaluation of equivalent ones.
export function cacheEquivalentAxes(model, evaluate) {
  const groupsBySignature = new Map();
  for (let slot = 0; slot < 3; slot += 1) {
    const signature = JSON.stringify(model.map(({ operators }) => (
      // The simulator assigns operators beyond the third the last slot's offset.
      operators.slice(slot, slot === 2 ? undefined : slot + 1)
        .map(({ moodDrop, moodRegen, outputBonus }) => [moodDrop, moodRegen, outputBonus])
    )));
    if (!groupsBySignature.has(signature)) groupsBySignature.set(signature, []);
    groupsBySignature.get(signature).push(slot);
  }
  const groups = [...groupsBySignature.values()].filter((group) => group.length > 1);
  if (!groups.length) return evaluate;
  const cache = new Map();
  return (axis) => {
    const canonical = [...axis];
    for (const group of groups) {
      const offsets = group.map((slot) => axis[slot]).sort((a, b) => a - b);
      group.forEach((slot, index) => { canonical[slot] = offsets[index]; });
    }
    const key = canonical.join("/");
    if (!cache.has(key)) cache.set(key, evaluate(axis));
    return cache.get(key);
  };
}
