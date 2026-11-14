// Rebuild the dev site, then run with the existing Playwright container:
// docker exec -i fraction_playwright node < tests/booking-form.cjs
// All Formspree requests are intercepted; no bookings are sent.
const assert = require('node:assert/strict');
const { chromium } = require('/tests/node_modules/playwright');

const url = process.env.BOOKING_TEST_URL || 'https://tenx.fraction.app/nadonthai.co.uk/book-a-table-morpeth/';
const endpoint = 'https://formspree.io/f/maypklnn';

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height: 1000 } });
      let submitted;
      const errors = [];
      await context.route('https://formspree.io/**', async route => {
        assert.equal(route.request().url(), endpoint);
        submitted = new URLSearchParams(route.request().postData());
        await route.fulfill({ status: 200, contentType: 'text/html', body: 'Booking intercepted for testing.' });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      const visit = async () => {
        await page.goto(url, { waitUntil: 'networkidle' });
        const reject = page.getByRole('button', { name: 'Reject analytics', exact: true });
        if (await reject.isVisible()) await reject.click();
      };
      const formIsValid = () => page.locator('#date').evaluate(input => input.form.checkValidity());
      const chosen = () => page.locator('[name="timebooking"]:checked').count();
      const fillDetails = async () => {
        await page.locator('#name').fill('Booking interface test');
        await page.locator('#email').fill('booking-test@example.invalid');
        await page.locator('#telephone').fill('01670000000');
        await page.locator('#guests').fill('2');
      };

      await visit();
      const marketingWording = 'Receive special offers and marketing emails from Nadon Thai';
      const marketingLabel = page.locator('label[for="marketing-opt-in"]');
      assert.equal(await marketingLabel.textContent(), marketingWording);
      assert.equal(await marketingLabel.evaluate(label => getComputedStyle(label).fontSize), '14px');
      const dateField = page.locator('#date');
      assert.equal(await dateField.getAttribute('readonly'), null, 'Date remains required and picker-enabled');
      await dateField.evaluate(input => {
        window.datePickerCalls = 0;
        const showPicker = input.showPicker;
        input.showPicker = function () {
          window.datePickerCalls++;
          return showPicker.call(this);
        };
      });
      // Click the date text and empty space, not just the calendar icon.
      const dateBounds = await dateField.boundingBox();
      for (const x of [8, Math.floor(dateBounds.width / 2)]) {
        const callsBefore = await page.evaluate(() => window.datePickerCalls);
        await dateField.click({ position: { x, y: dateBounds.height / 2 } });
        assert.equal(await page.evaluate(() => window.datePickerCalls), callsBefore + 1);
        await page.keyboard.press('Escape');
      }
      assert.equal(await dateField.getAttribute('inputmode'), 'none', 'Picker opened without errors');
      for (const key of ['Enter', 'Space', 'Alt+ArrowDown']) {
        await dateField.focus();
        const callsBefore = await page.evaluate(() => window.datePickerCalls);
        await page.keyboard.press(key);
        assert.equal(await page.evaluate(() => window.datePickerCalls), callsBefore + 1);
        await page.keyboard.press('Escape');
      }
      await dateField.fill('2026-11-20');
      await dateField.click({ position: { x: 8, y: dateBounds.height / 2 } });
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      assert.equal(await dateField.inputValue(), '2026-11-21', 'Native calendar still supports keyboard date selection');
      await dateField.fill('2026-11-20');
      await dateField.focus();
      await page.keyboard.type('01012030');
      for (const key of ['ArrowUp', 'ArrowDown', 'Backspace', 'Delete']) await page.keyboard.press(key);
      assert.equal(await dateField.inputValue(), '2026-11-20', 'Typing cannot change the selected date');
      for (const type of ['paste', 'drop']) {
        assert.equal(await dateField.evaluate((input, type) =>
          input.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })), type), false);
      }
      // Native date controls may tab through day/month/year segments first.
      for (let tab = 0; tab < 6 && await dateField.evaluate(input => input === document.activeElement); tab++) {
        await page.keyboard.press('Tab');
      }
      assert.equal(await dateField.evaluate(input => input === document.activeElement), false, 'Tab still moves focus');
      await dateField.fill('');
      assert.equal(await page.locator('#marketing-opt-in').isChecked(), false);
      const marketingCheckbox = page.locator('#marketing-opt-in');
      assert.equal(await marketingCheckbox.evaluate(input => getComputedStyle(input).borderTopColor), 'rgb(205, 164, 94)');
      await marketingCheckbox.focus();
      await page.keyboard.press('Space');
      assert.equal(await marketingCheckbox.isChecked(), true);
      const checkboxStyles = await marketingCheckbox.evaluate(input => {
        const style = getComputedStyle(input);
        return { background: style.backgroundColor, border: style.borderTopColor, focus: style.boxShadow, outline: style.outlineColor, image: style.backgroundImage };
      });
      assert.equal(checkboxStyles.background, 'rgb(205, 164, 94)');
      assert.equal(checkboxStyles.border, 'rgb(205, 164, 94)');
      assert(checkboxStyles.focus.includes('205, 164, 94'), 'Focus ring uses brand gold');
      assert.equal(checkboxStyles.outline, 'rgb(205, 164, 94)');
      assert(checkboxStyles.image.includes('%230c0b09'), 'Tick has contrast against gold');
      await page.keyboard.press('Space');
      assert.equal(await marketingCheckbox.isChecked(), false);
      assert.equal(await page.locator('select[name="timebooking"]').count(), 0);
      assert.equal(await chosen(), 0);
      assert.equal(await page.locator('.booking-time-slot:visible').count(), 24);
      assert.equal(await page.locator('#time-2100').isDisabled(), true);
      assert.equal(await page.getByRole('group', { name: 'Lunch', exact: true }).count(), 1);
      assert.equal(await page.getByRole('group', { name: 'Evening', exact: true }).count(), 1);

      await fillDetails();
      // Sunday through Saturday: late slots only appear on Friday and Saturday.
      for (let day = 15; day <= 21; day++) {
        await page.locator('#date').fill('2026-11-' + day);
        const lateAllowed = day === 20 || day === 21;
        assert.equal(await page.locator('.booking-time-slot:visible').count(), lateAllowed ? 26 : 24);
        assert.equal(await page.locator('#time-2045').isDisabled(), !lateAllowed);
        assert.equal(await page.locator('#time-2100').isDisabled(), !lateAllowed);
      }
      assert.equal(await formIsValid(), false, 'A time must be selected');
      await page.locator('label[for="time-2100"]').click();
      assert.equal(await formIsValid(), true);
      await page.locator('#date').fill('2026-11-22');
      assert.equal(await chosen(), 0, 'A late selection is cleared when switching to a weekday');
      assert.equal(await formIsValid(), false);

      // Radio buttons retain native keyboard navigation and single selection.
      await page.locator('#time-1200').focus();
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#time-1215').isChecked(), true);
      assert.equal(await chosen(), 1);
      assert.equal(await page.locator('#time-1215').evaluate(input =>
        getComputedStyle(input.nextElementSibling).backgroundColor), 'rgb(205, 164, 94)');
      assert.equal(await page.locator('#time-1215').evaluate(input =>
        getComputedStyle(input.nextElementSibling).outlineStyle), 'solid');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      const sizes = await page.locator('.booking-time-slot:visible label').evaluateAll(labels =>
        labels.map(label => ({ width: label.offsetWidth, height: label.offsetHeight })));
      assert(sizes.every(size => size.width >= 44 && size.height >= 44), 'Time buttons have usable touch targets');
      await page.locator('.booking-times').screenshot({ path: '/tmp/nadon-booking-times-' + width + '.png' });

      // Reset and clearing a date must also remove late options.
      await page.locator('#date').fill('2026-11-20');
      await page.locator('label[for="time-2045"]').click();
      await page.locator('#date').fill('');
      assert.equal(await chosen(), 0);
      assert.equal(await page.locator('#time-2045').isDisabled(), true);
      await page.locator('#date').fill('2026-11-20');
      await page.locator('#date').evaluate(input => input.form.reset());
      await page.waitForFunction(() => document.getElementById('time-2100').disabled);
      assert.equal(await chosen(), 0);

      // Preserve the exact Formspree time field and marketing consent in native POSTs.
      for (const optIn of [false, true]) {
        await visit();
        await fillDetails();
        await page.locator('#date').fill(optIn ? '2026-11-20' : '2026-11-22');
        const time = optIn ? '21:00' : '17:00';
        await page.locator('label[for="time-' + time.replace(':', '') + '"]').click();
        if (optIn) await page.locator('label[for="marketing-opt-in"]').click();
        assert.equal(await formIsValid(), true);
        await Promise.all([
          page.waitForURL(endpoint),
          page.getByRole('button', { name: 'Send Request', exact: true }).click()
        ]);
        assert.deepEqual(submitted.getAll('timebooking'), [time]);
        assert.deepEqual(submitted.getAll('marketing_opt_in'), [optIn ? 'Yes' : 'No']);
        assert.equal(submitted.get('marketing_consent_wording'), marketingWording);
        assert.equal(submitted.get('marketing_consent_version'), '2026-11-14.2');
        assert.equal(submitted.get('restaurant'), 'Morpeth');
        assert.equal(submitted.get('_replyto'), 'booking-test@example.invalid');
        assert.equal(submitted.get('date'), optIn ? '2026-11-20' : '2026-11-22');
      }
      assert.deepEqual(errors, []);
      console.log(width + 'px: clickable date picker, typing blocked, keyboard, layout, required selection, weekday/weekend rules, reset and intercepted Formspree posts pass');
      await context.close();
    }

    // The core time picker remains usable without JavaScript.
    const context = await browser.newContext({ ignoreHTTPSErrors: true, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('label[for="time-1700"]').click();
    assert.equal(await page.locator('#time-1700').isChecked(), true);
    assert.equal(await page.locator('#time-2100').isDisabled(), true);
    await context.close();
    console.log('No-JavaScript standard time selection passes. No bookings sent to Formspree.');

    // A missing/restricted showPicker must leave a usable native date control.
    for (const restricted of [false, true]) {
      const fallback = await browser.newContext({ ignoreHTTPSErrors: true });
      await fallback.addInitScript(restricted => {
        Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
          configurable: true,
          value: restricted ? function () { throw new DOMException('Restricted picker', 'SecurityError'); } : undefined
        });
      }, restricted);
      const fallbackPage = await fallback.newPage();
      await fallbackPage.goto(url, { waitUntil: 'networkidle' });
      const date = fallbackPage.locator('#date');
      if (restricted) await date.click();
      assert.equal(await date.getAttribute('inputmode'), null);
      assert.equal(await date.getAttribute('readonly'), null);
      await date.fill('2026-11-20');
      assert.equal(await date.inputValue(), '2026-11-20');
      await fallback.close();
    }
    console.log('Unsupported/restricted picker fallbacks pass.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
