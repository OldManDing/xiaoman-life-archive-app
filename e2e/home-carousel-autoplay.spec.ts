import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { loginWeb, webBaseURL } from './helpers';

const carouselDir = resolve(process.cwd(), 'artifacts', 'home-carousel-autoplay');

const carouselRecords = [
  ['carousel-record-1', '午后的光', 'timeline-child.png'],
  ['carousel-record-2', '一起散步', 'park-photo.png'],
  ['carousel-record-3', '家里的周末', 'room-photo.png'],
  ['carousel-record-4', '新的成长', 'avatar-child.png'],
].map(([recordNo, title, image], index) => ({
  record_no: recordNo,
  cover_media_no: null,
  cover_media_type: 'image',
  cover_url: `${webBaseURL}/reference-ui/${image}`,
  title,
  summary: '轮播动效回归样本',
  event_time: `2026-07-${String(28 - index).padStart(2, '0')}T08:00:00.000Z`,
  location_text: null,
  tags: [],
  creator_name: '家人',
  is_milestone: false,
  record_type: 'image',
  status: 'published',
}));

async function getActiveSlideIndex(page: Page) {
  return page.locator('[data-photo-carousel="true"]').first().getAttribute('data-photo-active-index');
}

test('home photo carousel advances automatically', async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/records?*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      json: {
        code: 0,
        message: 'ok',
        data: {
          list: carouselRecords,
          page: 1,
          page_size: carouselRecords.length,
          total: carouselRecords.length,
          has_more: false,
        },
      },
    });
  });
  await loginWeb(page);

  const carousel = page.locator('[data-photo-carousel="true"]').first();
  await expect(carousel).toBeVisible();

  await expect(page.locator('[data-photo-slide]')).toHaveCount(carouselRecords.length);
  await expect(carousel).toHaveAttribute('data-photo-layout', 'drawer');

  await mkdir(carouselDir, { recursive: true });
  const initialIndex = await getActiveSlideIndex(page);
  expect(initialIndex).not.toBeNull();
  await carousel.screenshot({ path: resolve(carouselDir, 'home-carousel-before.png') });

  await page.waitForFunction(
    (previousIndex) => document.querySelector('[data-photo-carousel="true"]')?.getAttribute('data-photo-active-index') !== previousIndex,
    initialIndex,
    { timeout: 3000 },
  );

  const nextIndex = await getActiveSlideIndex(page);
  expect(nextIndex).not.toBe(initialIndex);
  await expect(page.locator('.home-photo-incoming-forward')).toHaveCount(1);
  await carousel.screenshot({ path: resolve(carouselDir, 'home-carousel-after.png') });

  await page.getByRole('button', { name: '选择照片：新的成长' }).evaluate((element) => (element as HTMLElement).click());
  await expect(carousel).toHaveAttribute('data-photo-active-index', '3');

  await page.waitForFunction(
    () => document.querySelector('[data-photo-carousel="true"]')?.getAttribute('data-photo-active-index') === '0',
    undefined,
    { timeout: 4500 },
  );
  await expect(page.locator('.home-photo-incoming-forward')).toHaveCount(1);
  await carousel.screenshot({ path: resolve(carouselDir, 'home-carousel-looped.png') });
});
