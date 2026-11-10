import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const required = ['EYLO_E2E_BASE_URL', 'EYLO_E2E_HOST_EMAIL', 'EYLO_E2E_HOST_PASSWORD', 'EYLO_E2E_GUEST_EMAIL', 'EYLO_E2E_GUEST_PASSWORD'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Missing required staging settings: ${missing.join(', ')}`);

const target = new URL(process.env.EYLO_E2E_BASE_URL);
if (target.protocol !== 'https:' || target.hostname === 'eyloai.vercel.app') {
  throw new Error('Use an HTTPS staging/preview origin. This test refuses the EYLO production hostname.');
}
if (process.env.EYLO_E2E_CONFIRM_DATA_MUTATION !== 'YES') {
  throw new Error('Set EYLO_E2E_CONFIRM_DATA_MUTATION=YES to allow creation of a test meeting in this staging workspace.');
}
const baseUrl = target.origin;
const timeout = Number(process.env.EYLO_E2E_TIMEOUT_MS || 45_000);
const hostAccount = { email: process.env.EYLO_E2E_HOST_EMAIL, password: process.env.EYLO_E2E_HOST_PASSWORD };
const guestAccount = { email: process.env.EYLO_E2E_GUEST_EMAIL, password: process.env.EYLO_E2E_GUEST_PASSWORD };
const headless = process.env.EYLO_E2E_HEADLESS === 'true';

let browser;
let hostContext;
let guestContext;
let host;
let guest;
let hostRoom;

async function login(page, account) {
  await page.goto(new URL('/login?from=%2Fmeetings', baseUrl).href);
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Continue with password' }).click();
  await page.getByRole('heading', { name: 'Continue your research' }).waitFor({ state: 'detached', timeout });
  await page.goto(new URL('/meetings', baseUrl).href);
  await page.getByRole('button', { name: 'Start video meeting' }).waitFor({ timeout });
}

async function roomConnected(page, count) {
  await page.getByRole('dialog', { name: 'EYLO video meeting' }).getByText(new RegExp(`Connected · ${count} participants?`)).waitFor({ timeout });
}

async function liveMedia(page) {
  await page.waitForFunction(() => {
    const live = (element, kind) => element.srcObject?.getTracks().some(track => track.kind === kind && track.readyState === 'live');
    const videos = [...document.querySelectorAll('video')].filter(element => live(element, 'video'));
    const audio = [...document.querySelectorAll('audio')].filter(element => live(element, 'audio'));
    return videos.length >= 2 && audio.length >= 1;
  }, undefined, { timeout });
  return page.evaluate(() => ({
    videoElementsWithLiveVideo: [...document.querySelectorAll('video')].filter(element =>
      element.srcObject?.getVideoTracks().some(track => track.readyState === 'live')).length,
    audioElementsWithLiveAudio: [...document.querySelectorAll('audio')].filter(element =>
      element.srcObject?.getAudioTracks().some(track => track.readyState === 'live')).length,
  }));
}

try {
  browser = await chromium.launch({ headless });
  const permissions = ['camera', 'microphone', 'clipboard-read', 'clipboard-write'];
  hostContext = await browser.newContext({ permissions, viewport: { width: 1365, height: 900 } });
  guestContext = await browser.newContext({ permissions, viewport: { width: 1280, height: 800 } });
  host = await hostContext.newPage();
  guest = await guestContext.newPage();
  host.setDefaultTimeout(timeout);
  guest.setDefaultTimeout(timeout);

  await login(host, hostAccount);
  await host.getByRole('button', { name: 'Start video meeting' }).click();
  hostRoom = host.getByRole('dialog', { name: 'EYLO video meeting' });
  await hostRoom.waitFor();
  await roomConnected(host, 1);

  await hostRoom.getByPlaceholder('researcher@example.edu').fill(guestAccount.email);
  await hostRoom.getByRole('button', { name: 'Invite', exact: true }).click();
  await hostRoom.getByRole('status').filter({ hasText: 'Invitation link created' }).waitFor();
  await hostRoom.getByRole('button', { name: 'Copy restricted link' }).click();
  const inviteUrl = await host.evaluate(() => navigator.clipboard.readText());
  const parsedInvite = new URL(inviteUrl);
  assert.equal(parsedInvite.origin, baseUrl, 'restricted invitation must point to the configured EYLO staging origin');
  assert.ok(parsedInvite.searchParams.get('invite'), 'invitation link must contain a restricted token');
  assert.ok(parsedInvite.searchParams.get('meeting'), 'invitation link must identify the meeting');

  await login(guest, guestAccount);
  await guest.goto(inviteUrl);
  await guest.getByRole('button', { name: 'Join meeting' }).waitFor({ timeout });
  await guest.getByRole('button', { name: 'Join meeting' }).click();
  await roomConnected(host, 2);
  await roomConnected(guest, 2);

  const [hostMedia, guestMedia] = await Promise.all([liveMedia(host), liveMedia(guest)]);
  assert.ok(hostMedia.videoElementsWithLiveVideo >= 2 && guestMedia.videoElementsWithLiveVideo >= 2,
    'each independent browser must receive live local and remote camera tracks');
  assert.ok(hostMedia.audioElementsWithLiveAudio >= 1 && guestMedia.audioElementsWithLiveAudio >= 1,
    'each independent browser must receive the other participant audio track');

  const marker = `EYLO live-call check ${Date.now()}`;
  await hostRoom.getByLabel('Meeting message').fill(marker);
  await hostRoom.getByRole('button', { name: 'Send message' }).click();
  await guest.getByRole('dialog', { name: 'EYLO video meeting' }).getByText(marker).waitFor();

  await hostRoom.getByRole('button', { name: 'Mute microphone' }).click();
  await hostRoom.getByRole('button', { name: 'Unmute microphone' }).waitFor();
  await hostRoom.getByRole('button', { name: 'Unmute microphone' }).click();
  await hostRoom.getByRole('button', { name: 'Mute microphone' }).waitFor();
  await hostRoom.getByRole('button', { name: 'Turn camera off' }).click();
  await hostRoom.getByText('Camera off').first().waitFor();
  await hostRoom.getByRole('button', { name: 'Turn camera on' }).click();
  await hostRoom.getByRole('button', { name: 'Turn camera off' }).waitFor();

  if (process.env.EYLO_E2E_SCREEN_SHARE === '1') {
    console.log('Select a screen/window in the browser sharing prompt within 60 seconds.');
    await hostRoom.getByRole('button', { name: 'Share screen' }).click();
    await hostRoom.getByRole('button', { name: 'Stop screen sharing' }).waitFor({ timeout: 60_000 });
    await guest.waitForFunction(() => [...document.querySelectorAll('video')].filter(element =>
      element.srcObject?.getVideoTracks().some(track => track.readyState === 'live')).length >= 3, undefined, { timeout });
    await hostRoom.getByRole('button', { name: 'Stop screen sharing' }).click();
    await hostRoom.getByRole('button', { name: 'Share screen' }).waitFor();
  }

  if (process.env.EYLO_E2E_RECONNECT === '1') {
    await guestContext.setOffline(true);
    await guest.getByRole('dialog', { name: 'EYLO video meeting' }).getByText(/reconnecting|disconnected/i).waitFor({ timeout: 20_000 });
    await guestContext.setOffline(false);
    await roomConnected(guest, 2);
    await roomConnected(host, 2);
  }

  await guest.getByRole('dialog', { name: 'EYLO video meeting' }).getByRole('button', { name: 'Leave' }).click();
  await roomConnected(host, 1);
  await hostRoom.getByRole('button', { name: 'End meeting' }).click();
  await hostRoom.waitFor({ state: 'detached' });

  console.log(JSON.stringify({
    result: 'PASS',
    target: baseUrl,
    participants: 2,
    hostMedia,
    guestMedia,
    chat: 'delivered',
    microphoneToggle: 'passed',
    cameraToggle: 'passed',
    screenShare: process.env.EYLO_E2E_SCREEN_SHARE === '1' ? 'passed' : 'not run',
    reconnection: process.env.EYLO_E2E_RECONNECT === '1' ? 'passed' : 'not run',
    meetingEnded: true,
  }, null, 2));
} catch (error) {
  console.error('Native EYLO two-account browser test failed. No password/token values are logged.');
  console.error(error);
  process.exitCode = 1;
} finally {
  if (hostRoom) {
    try {
      const end = hostRoom.getByRole('button', { name: 'End meeting' });
      if (await end.isVisible({ timeout: 1_000 })) await end.click({ timeout: 2_000 });
    } catch {
      // Best-effort cleanup in the explicitly authorized staging workspace.
    }
  }
  await Promise.allSettled([guestContext?.close(), hostContext?.close()]);
  await browser?.close();
}
