import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { loginWeb } from './helpers';

const carouselDir = resolve(process.cwd(), 'artifacts', 'home-carousel-autoplay');

async function getActiveSlideIndex(page: Page) {
  return page.locator('[data-photo-slide][aria-hidden="false"]').getAttribute('data-photo-slide');
}

test('home photo carousel advances automatically', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await loginWeb(page);

  const carousel = page.locator('[data-photo-carousel="true"]').first();
  await expect(carousel).toBeVisible();

  const slideCount = await page.locator('[data-photo-slide]').count();
  expect(slideCount).toBeGreaterThan(1);

  await mkdir(carouselDir, { recursive: true });
  const initialIndex = await getActiveSlideIndex(page);
  expect(initialIndex).not.toBeNull();
  await carousel.screenshot({ path: resolve(carouselDir, 'home-carousel-before.png') });

  await page.waitForFunction(
    (previousIndex) => document.querySelector('[data-photo-slide][aria-hidden="false"]')?.getAttribute('data-photo-slide') !== previousIndex,
    initialIndex,
    { timeout: 2500 },
  );

  const nextIndex = await getActiveSlideIndex(page);
  expect(nextIndex).not.toBe(initialIndex);
  await carousel.screenshot({ path: resolve(carouselDir, 'home-carousel-after.png') });
});
