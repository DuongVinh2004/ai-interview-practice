import { Injectable } from '@nestjs/common';

export interface PatchExportResult {
  patch: string;
  stats: {
    additions: number;
    deletions: number;
    filesChanged: number;
  };
}

@Injectable()
export class ArenaPatchExporterService {
  /**
   * Generates a unified git patch between initial boilerplate and final candidate code
   */
  generateUnifiedPatch(
    initialFiles: Record<string, string>,
    finalFiles: Record<string, string>,
  ): PatchExportResult {
    const allPaths = Array.from(
      new Set([...Object.keys(initialFiles), ...Object.keys(finalFiles)]),
    );
    let patchOutput = '';
    let totalAdditions = 0;
    let totalDeletions = 0;
    let filesChanged = 0;

    for (const filePath of allPaths) {
      const oldContent = initialFiles[filePath];
      const newContent = finalFiles[filePath];

      if (oldContent === newContent) {
        continue; // No change in this file
      }

      filesChanged += 1;
      const oldLines = oldContent !== undefined ? oldContent.split('\n') : [];
      const newLines = newContent !== undefined ? newContent.split('\n') : [];

      patchOutput += `diff --git a/${filePath} b/${filePath}\n`;
      patchOutput += `--- a/${filePath}\n`;
      patchOutput += `+++ b/${filePath}\n`;
      patchOutput += `@@ -1,${oldLines.length} +1,${newLines.length} @@\n`;

      if (oldContent !== undefined) {
        for (const line of oldLines) {
          if (!newLines.includes(line)) {
            patchOutput += `-${line}\n`;
            totalDeletions += 1;
          }
        }
      }

      if (newContent !== undefined) {
        for (const line of newLines) {
          if (!oldLines.includes(line)) {
            patchOutput += `+${line}\n`;
            totalAdditions += 1;
          }
        }
      }
    }

    return {
      patch: patchOutput,
      stats: {
        additions: totalAdditions,
        deletions: totalDeletions,
        filesChanged,
      },
    };
  }
}
