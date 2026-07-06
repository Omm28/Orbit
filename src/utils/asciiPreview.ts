// ──────────────────────────────────────────────────
//  Orbit – ASCII Viewport Terminal Preview Utility
//  Renders a compact text-based representation
//  of element locations on the page.
// ──────────────────────────────────────────────────

import { PageElement } from "../types";

export function renderAsciiPreview(elements: PageElement[]): string {
  const COLS = 60;
  const ROWS = 15;
  const grid: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(" "));

  // Draw borders
  for (let c = 0; c < COLS; c++) {
    grid[0][c] = "─";
    grid[ROWS - 1][c] = "─";
  }
  for (let r = 0; r < ROWS; r++) {
    grid[r][0] = "│";
    grid[r][COLS - 1] = "│";
  }
  grid[0][0] = "┌";
  grid[0][COLS - 1] = "┐";
  grid[ROWS - 1][0] = "└";
  grid[ROWS - 1][COLS - 1] = "┘";

  // Filter elements that have coordinates and are visible
  const visibleElements = elements.filter(
    (el) => el.visible && el.x !== undefined && el.y !== undefined
  );

  for (const el of visibleElements) {
    const x = el.x!;
    const y = el.y!;
    
    // Scale coordinate to grid size (relative to 1280x800 standard viewport)
    const col = Math.min(COLS - 6, Math.max(1, Math.floor((x / 1280) * (COLS - 2))));
    const row = Math.min(ROWS - 2, Math.max(1, Math.floor((y / 800) * (ROWS - 2))));

    const label = `[${el.orbitId}:${el.tag}]`;
    
    // Write label into the grid cells starting at (row, col)
    for (let i = 0; i < label.length; i++) {
      if (col + i < COLS - 1) {
        grid[row][col + i] = label[i];
      }
    }
  }

  return grid.map((line) => line.join("")).join("\n");
}
