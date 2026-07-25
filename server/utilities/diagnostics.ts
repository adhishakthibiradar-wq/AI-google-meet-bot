import fs from 'fs';
import path from 'path';
import type { Page } from 'puppeteer';
import { logger } from './logger.js';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');

export type JoinStep = 'launch' | 'meet-loaded' | 'before-join' | 'after-join' | 'error';

class Diagnostics {
  private ensureDir() {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  }

  public screenshotPath(step: JoinStep): string {
    return path.join(SCREENSHOT_DIR, `${step}.png`);
  }

  /** Screenshots the current page state; never throws so it cannot mask the real failure. */
  public async capture(page: Page | null, step: JoinStep): Promise<string | null> {
    if (!page || page.isClosed()) {
      logger.warn(`Cannot capture "${step}" screenshot: no open page`, 'browser');
      return null;
    }

    this.ensureDir();
    const filePath = this.screenshotPath(step);
    try {
      await page.screenshot({ path: filePath as `${string}.png`, fullPage: false });
      logger.info(`Saved screenshot: ${filePath}`, 'browser');
      return filePath;
    } catch (err: any) {
      logger.warn(`Screenshot "${step}" failed: ${err?.message || err}`, 'browser');
      return null;
    }
  }

  /**
   * Dumps the page HTML plus a screenshot when a selector cannot be found, so the
   * exact page Google Meet served (sign-in wall, "call ended", consent) is inspectable.
   */
  public async dumpSelectorFailure(page: Page | null, selector: string, context: string) {
    logger.error(`Selector not found (${context}): ${selector}`, 'browser');
    if (!page || page.isClosed()) return;

    this.ensureDir();
    const htmlPath = path.join(SCREENSHOT_DIR, 'error.html');
    try {
      const [url, title, html] = await Promise.all([
        Promise.resolve(page.url()),
        page.title(),
        page.content(),
      ]);
      fs.writeFileSync(htmlPath, html, 'utf-8');
      logger.error(`Page at failure: "${title}" (${url}) — HTML dumped to ${htmlPath}`, 'browser');
      logger.info(`Visible page text: ${await this.visibleText(page)}`, 'browser');
    } catch (err: any) {
      logger.warn(`Could not dump page HTML: ${err?.message || err}`, 'browser');
    }

    await this.capture(page, 'error');
  }

  private async visibleText(page: Page): Promise<string> {
    const text = await page.evaluate(() => document.body?.innerText || '');
    return text.replace(/\s+/g, ' ').trim().slice(0, 600);
  }
}

export const diagnostics = new Diagnostics();
