export interface DiffToken {
  type: "added" | "removed" | "unchanged";
  value: string;
}

/**
 * Computes a beautiful word-by-word diff between two strings,
 * preserving spaces and line breaks exactly for gorgeous layout.
 */
export function computeWordDiff(oldText: string, newText: string): DiffToken[] {
  // Graceful fallback for empty inputs
  if (!oldText) {
    return [{ type: "added", value: newText }];
  }
  if (!newText) {
    return [{ type: "removed", value: oldText }];
  }

  // Tokenize by splitting on word boundaries or whitespaces/newlines
  const oldTokens = oldText.split(/(\s+)/);
  const newTokens = newText.split(/(\s+)/);

  const m = oldTokens.length;
  const n = newTokens.length;

  // Safe boundary check: if files are exceptionally huge, fall back to line diff
  // or a basic paragraph match to prevent performance overhead.
  if (m * n > 2000000) {
    return computeSimpleLineDiff(oldText, newText);
  }

  // Classical DP-based LCS algorithm
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffToken[] = [];
  let i = m;
  let j = n;

  // Backtrack to find the diff path
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      result.unshift({ type: "unchanged", value: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", value: newTokens[j - 1] });
      j--;
    } else {
      result.unshift({ type: "removed", value: oldTokens[i - 1] });
      i--;
    }
  }

  return result;
}

function computeSimpleLineDiff(oldText: string, newText: string): DiffToken[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffToken[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      if (o !== undefined) result.push({ type: "unchanged", value: o + "\n" });
    } else {
      if (o !== undefined) result.push({ type: "removed", value: o + "\n" });
      if (n !== undefined) result.push({ type: "added", value: n + "\n" });
    }
  }
  return result;
}
