import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppUpdateInfo, AppUpdateState } from '../types';
import { APP_VERSION, isNewerVersion, parseSemver } from '../utils/version';

const GITHUB_REPO_OWNER = 'jonathancollars-ops';
const GITHUB_REPO_NAME = 'organiza';
const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
const UPDATE_STATE_KEY = '@lumen_update_state';

// Throttle automatic checks: check at most once every 3 hours on cold start
const AUTO_CHECK_INTERVAL_MS = 3 * 60 * 60 * 1000;

export class AppUpdateService {
  /**
   * Retrieves the current application version string.
   */
  public static getCurrentVersion(): string {
    return APP_VERSION;
  }

  /**
   * Retrieves stored update state (last checked timestamp and ignored version).
   * Guaranteed to return a valid object, even when storage holds "null", corrupted strings, or empty data.
   */
  public static async getUpdateState(): Promise<AppUpdateState> {
    try {
      const raw = await AsyncStorage.getItem(UPDATE_STATE_KEY);
      if (raw && typeof raw === 'string' && raw.trim().length > 0) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as AppUpdateState;
        }
      }
    } catch {
      // Ignore read and parse errors safely
    }
    return {};
  }

  /**
   * Saves updated update state to storage.
   */
  public static async saveUpdateState(state: Partial<AppUpdateState>): Promise<void> {
    try {
      const current = await this.getUpdateState();
      const safeCurrent = (current && typeof current === 'object' && !Array.isArray(current)) ? current : {};
      const safeState = (state && typeof state === 'object' && !Array.isArray(state)) ? state : {};
      const merged: AppUpdateState = { ...safeCurrent, ...safeState };
      await AsyncStorage.setItem(UPDATE_STATE_KEY, JSON.stringify(merged));
    } catch {
      // Ignore write errors
    }
  }

  /**
   * Checks GitHub Releases API for new updates.
   * @param force When true, bypasses automatic throttle interval.
   */
  public static async checkForUpdates(force: boolean = false): Promise<AppUpdateInfo | null> {
    let timeoutId: any = null;
    try {
      const state = await this.getUpdateState();
      const now = Date.now();

      // Skip if checked recently unless forced
      if (!force && state?.lastCheckedAt && (now - state.lastCheckedAt) < AUTO_CHECK_INTERVAL_MS) {
        return null;
      }

      // Record check timestamp
      await this.saveUpdateState({ lastCheckedAt: now });

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(GITHUB_RELEASES_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Lumen-App-Client'
        },
        signal: controller.signal
      });

      if (!response.ok) {
        return null;
      }

      const release = await response.json();
      if (!release || typeof release !== 'object' || !release.tag_name || typeof release.tag_name !== 'string') {
        return null;
      }

      const rawTag = release.tag_name as string;
      const latestVersion = rawTag.replace(/^v/i, '');

      // Check if remote version is strictly newer than current app version
      const hasUpdate = isNewerVersion(latestVersion, APP_VERSION);
      if (!hasUpdate) {
        return {
          hasUpdate: false,
          currentVersion: APP_VERSION,
          latestVersion: latestVersion,
          downloadUrl: typeof release.html_url === 'string' ? release.html_url : ''
        };
      }

      // Check if user chose to ignore this specific version (unless manual force check)
      if (!force && state?.ignoredVersion === latestVersion) {
        return null;
      }

      // Locate .apk asset in release assets
      let apkDownloadUrl = typeof release.html_url === 'string' ? release.html_url : '';
      if (Array.isArray(release.assets)) {
        const apkAsset = release.assets.find((asset: any) =>
          asset && typeof asset.name === 'string' && asset.name.toLowerCase().endsWith('.apk')
        );
        if (apkAsset && typeof apkAsset.browser_download_url === 'string') {
          apkDownloadUrl = apkAsset.browser_download_url;
        }
      }

      return {
        hasUpdate: true,
        currentVersion: APP_VERSION,
        latestVersion: latestVersion,
        releaseName: typeof release.name === 'string' ? release.name : `Lumen v${latestVersion}`,
        releaseNotes: typeof release.body === 'string' ? release.body : 'Melhorias de estabilidade, desempenho e correções visuais.',
        downloadUrl: apkDownloadUrl,
        publishedAt: typeof release.published_at === 'string' ? release.published_at : undefined,
        isMandatory: false
      };
    } catch (error) {
      // Network drops or offline states are handled silently
      return null;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * Opens the download URL in the device's browser / package installer.
   */
  public static async openDownloadUrl(url: string): Promise<boolean> {
    try {
      if (!url || typeof url !== 'string' || url.trim().length === 0) return false;
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return true;
      }
    } catch {
      // Fallback
    }
    return false;
  }

  /**
   * Sets a version to be ignored on automatic checks until the next release.
   */
  public static async ignoreVersion(version: string): Promise<void> {
    if (version && typeof version === 'string') {
      await this.saveUpdateState({ ignoredVersion: version });
    }
  }
}
