// Persisted opt-in: old trees and older open adoption previews keep their
// historical branch identities until a new interaction upgrades their policy.
export const NATURAL_GROWTH='natural-5';
export const WHOLE_TREE_GROWTH_POLICIES=['natural-4',NATURAL_GROWTH];
export const SPACE_GROWTH_POLICIES=['natural-3',...WHOLE_TREE_GROWTH_POLICIES];
export const GRADUAL_GROWTH_POLICIES=['natural-2',...SPACE_GROWTH_POLICIES];
export const NATURAL_GROWTH_POLICIES=['natural-1',...GRADUAL_GROWTH_POLICIES];
