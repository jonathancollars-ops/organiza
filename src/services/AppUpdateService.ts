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
   */
  public static async getUpdateState(): Promise<AppUpdateState> {
    try {
      const raw = await AsyncStorage.getItem(UPDATE_STATE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Ignore read errors
    }
    return {};
  }

  /**
   * Saves updated update state to storage.
   */
  public static async saveUpdateState(state: Partial<AppUpdateState>): Promise<void> {
    try {
      const current = await this.getUpdateState();
      const merged = { ...current, ...state };
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
    try {
      const state = await this.getUpdateState();
      const now = Date.now();

      // Skip if checked recently unless forced
      if (!force && state.lastCheckedAt && now - state.lastCheckedAt < AUTO_CHECK_INTERVAL_MS) {
        return null;
      }

      // Record check timestamp
      await this.saveUpdateState({ lastCheckedAt: now });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(GITHUB_RELEASES_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Lumen-App-Client'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const release = await response.json();
      if (!release || typeof release !== 'object' || !release.tag_name) {
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
          downloadUrl: release.html_url || ''
        };
      }

      // Check if user chose to ignore this specific version (unless manual force check)
      if (!force && state.ignoredVersion === latestVersion) {
        return null;
      }

      // Locate .apk asset in release assets
      let apkDownloadUrl = release.html_url || '';
      if (Array.isArray(release.assets)) {
        const apkAsset = release.assets.find((asset: any) =>
          typeof asset.name === 'string' && asset.name.toLowerCase().endsWith('.apk')
        );
        if (apkAsset && apkAsset.browser_download_url) {
          apkDownloadUrl = apkAsset.browser_download_url;
        }
      }

      return {
        hasUpdate: true,
        currentVersion: APP_VERSION,
        latestVersion: latestVersion,
        releaseName: release.name || `Lumen v${latestVersion}`,
        releaseNotes: release.body || 'Melhorias de estabilidade, desempenho e correções visuais.',
        downloadUrl: apkDownloadUrl,
        publishedAt: release.published_at,
        isMandatory: false
      };
    } catch (error) {
      // Network drops or offline states are handled silently
      return null;
    }
  }

  /**
   * Opens the download URL in the device's browser / package installer.
   */
  public static async openDownloadUrl(url: string): Promise<boolean> {
    try {
      if (!url) return false;
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
    await this.saveUpdateState({ ignoredVersion: version });
  }
}
