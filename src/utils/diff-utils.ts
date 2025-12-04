import { createTwoFilesPatch } from 'diff';

/**
 * Generates a unified diff string between two strings using the 'diff' library.
 */
export function generateDiff(fileName: string, oldContent: string, newContent: string): string {
  const patch = createTwoFilesPatch(
    `a/${fileName}`, 
    `b/${fileName}`, 
    oldContent, 
    newContent, 
    '', 
    ''
  );

  // Remove the first two lines (Index: ... and ===...) produced by jsdiff if present
  // and add git style header
  const lines = patch.split('\n');
  // jsdiff output usually starts with:
  // ===================================================================
  // --- a/file
  // +++ b/file
  
  // We want:
  // diff --git a/file b/file
  // --- a/file
  // +++ b/file
  
  let startIdx = 0;
  if (lines[0].startsWith('=')) startIdx = 1;
  
  return `diff --git a/${fileName} b/${fileName}\n` + lines.slice(startIdx).join('\n');
}
