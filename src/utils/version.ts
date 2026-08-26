import { VersionBumpType } from '../types';

/**
 * Lumen Current Application Version
 * Strict Semantic Versioning: MAJOR.MINOR.PATCH
 */
export const APP_VERSION = '3.1.0';

export interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

/**
 * Cleans and parses a version string (e.g. "v3.1.0", "3.0.0-rc1", "3.2") into numeric components.
 */
export function parseSemver(versionString: string | null | undefined): ParsedSemver {
  if (!versionString || typeof versionString !== 'string') {
    return { major: 0, minor: 0, patch: 0, raw: '0.0.0' };
  }

  // Remove leading 'v' or 'V' and any whitespace
  const clean = versionString.trim().replace(/^v/i, '');

  // Extract major, minor, patch (ignoring prerelease suffixes like -beta)
  const mainPart = clean.split('-')[0];
  const parts = mainPart.split('.').map(p => {
    const num = parseInt(p, 10);
    return isNaN(num) ? 0 : Math.max(0, num);
  });

  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;

  return {
    major,
    minor,
    patch,
    raw: `${major}.${minor}.${patch}`
  };
}

/**
 * Compares two semantic version strings.
 * Returns:
 *   1 if v1 > v2 (v1 is newer)
 *  -1 if v1 < v2 (v1 is older)
 *   0 if v1 === v2 (equal)
 */
export function compareSemver(v1: string, v2: string): number {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);

  if (p1.major !== p2.major) {
    return p1.major > p2.major ? 1 : -1;
  }
  if (p1.minor !== p2.minor) {
    return p1.minor > p2.minor ? 1 : -1;
  }
  if (p1.patch !== p2.patch) {
    return p1.patch > p2.patch ? 1 : -1;
  }
  return 0;
}

/**
 * Returns true if remoteVersion is strictly newer than currentVersion.
 */
export function isNewerVersion(remoteVersion: string, currentVersion: string = APP_VERSION): boolean {
  return compareSemver(remoteVersion, currentVersion) > 0;
}

/**
 * Calculates the next version string based on strict SemVer release rules:
 * - 'patch' (+0.0.1): Bugfixes, UI polish, minor styling corrections.
 * - 'minor' (+0.1.0): New features, screen additions, medium functional upgrades. Resets patch to 0.
 * - 'major' (+1.0.0): Major structural overhauls, breaking architecture shifts. Resets minor & patch to 0.
 */
export function bumpVersion(currentVersion: string, bumpType: VersionBumpType): string {
  const parsed = parseSemver(currentVersion);

  switch (bumpType) {
    case 'patch':
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    case 'minor':
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case 'major':
      return `${parsed.major + 1}.0.0`;
    default:
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }
}
