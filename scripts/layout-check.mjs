import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Uses Bun's native WebSocket because Playwright's Windows pipe/ws transport
// can hang on Bun 1.3.11. Connect only to an isolated local test browser.
const endpoint = process.env.NEUZ_TEST_CDP_URL;
if (!endpoint || !/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint)) {
  throw new Error(
    "Set NEUZ_TEST_CDP_URL to an isolated Chrome local debugging endpoint.",
  );
}
const version = await (await fetch(endpoint + "/json/version")).json();
const socket = new WebSocket(version.webSocketDebuggerUrl);
let nextId = 0;
let session;
const pending = new Map();
const listeners = new Map();
const hydrationErrors = [];
const pageErrors = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  } else {
    if (message.method === "Runtime.consoleAPICalled") {
      const text = message.params.args
        .map((arg) => arg.value ?? arg.description ?? "")
        .join(" ");
      if (/hydration|hydrated|server.rendered/i.test(text))
        hydrationErrors.push(text);
    }
    if (message.method === "Runtime.exceptionThrown") {
      pageErrors.push(
        message.params.exceptionDetails.exception?.description ??
          message.params.exceptionDetails.text,
      );
    }
    const callbacks = listeners.get(message.method) || [];
    listeners.delete(message.method);
    callbacks.forEach((callback) => callback(message.params));
  }
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(
    () => reject(new Error("Browser connection timeout")),
    10000,
  );
  socket.addEventListener(
    "open",
    () => {
      clearTimeout(timer);
      resolve();
    },
    { once: true },
  );
  socket.addEventListener(
    "error",
    () => {
      clearTimeout(timer);
      reject(new Error("Browser connection failed"));
    },
    { once: true },
  );
});
function send(method, params = {}, targetSession = session) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(method + " timed out"));
    }, 20000);
    pending.set(id, { resolve, reject, timer });
    socket.send(
      JSON.stringify({
        id,
        method,
        params,
        sessionId: targetSession || undefined,
      }),
    );
  });
}
function once(method) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(method + " timed out")),
      20000,
    );
    listeners.set(method, [
      ...(listeners.get(method) || []),
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
    ]);
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text,
    );
  return result.result.value;
}
function measure() {
  const rect = (selector) => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      width: r.width,
      height: r.height,
    };
  };
  const hero = rect(".hero"),
    cta = rect(".hero-content .text-link"),
    bottom = rect(".hero-bottom");
  const columns = getComputedStyle(
    document.querySelector(".gallery"),
  ).gridTemplateColumns.split(" ").length;
  const cards = [...document.querySelectorAll(".art-card")].map((el) => {
    const r = el.querySelector(".card-image").getBoundingClientRect();
    const caption = el.querySelector(".card-caption").getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, caption: caption.top };
  });
  const rows = Array.from(
    { length: Math.ceil(cards.length / columns) },
    (_, i) => cards.slice(i * columns, (i + 1) * columns),
  );
  return {
    hero,
    cta,
    bottom,
    footerGap: bottom.top - cta.bottom,
    heroContentFits:
      cta.bottom + 24 <= bottom.top && bottom.bottom <= hero.bottom + 1,
    aligned: rows.every((row) =>
      row.every(
        (card) =>
          Math.abs(card.top - row[0].top) < 1 &&
          Math.abs(card.bottom - row[0].bottom) < 1 &&
          Math.abs(card.caption - row[0].caption) < 1,
      ),
    ),
    noOverflow: document.documentElement.scrollWidth <= innerWidth,
    extensionAttributes: document.querySelectorAll("[bis_skin_checked]").length,
  };
}
const sizes = [
  { width: 1902, height: 870 },
  { width: 1522, height: 696 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 375, height: 812 },
  { width: 320, height: 740 },
  { width: 812, height: 375 },
];
const results = [];
await mkdir("tmp/qa", { recursive: true });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
session = (await send("Target.attachToTarget", { targetId, flatten: true }))
  .sessionId;
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  for (const locale of ["fr", "en", "ar"]) {
    console.log("Checking " + locale + " layout...");
    const loaded = once("Page.loadEventFired");
    await send("Page.navigate", { url: "http://127.0.0.1:3000/" + locale });
    await loaded;
    await evaluate("(async()=>{await document.fonts.ready; return true;})()");
    for (const viewport of sizes) {
      await send("Emulation.setDeviceMetricsOverride", {
        ...viewport,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evaluate(
        "new Promise(resolve=>{scrollTo(0,0);requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)));})",
      );
      const layout = await evaluate("(" + measure.toString() + ")()");
      results.push({ locale, viewport, ...layout });
      if (locale === "fr" && viewport.width === 1522) {
        const heroShot = await send("Page.captureScreenshot", {
          format: "png",
        });
        await writeFile(
          "tmp/qa/layout-after-hero.png",
          Buffer.from(heroShot.data, "base64"),
        );
        await evaluate(
          "(async()=>{document.querySelector('.gallery').scrollIntoView();await Promise.all([...document.querySelectorAll('.gallery img')].map(img=>{img.loading='eager';return img.decode().catch(()=>{});}));return true;})()",
        );
        const clip = await evaluate(
          "(()=>{const r=document.querySelector('.gallery').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1};})()",
        );
        const galleryShot = await send("Page.captureScreenshot", {
          format: "png",
          clip,
          captureBeyondViewport: true,
        });
        await writeFile(
          "tmp/qa/layout-after-gallery.png",
          Buffer.from(galleryShot.data, "base64"),
        );
      }
    }
  }
  await writeFile(
    "tmp/qa/layout-after.json",
    JSON.stringify({ results, hydrationErrors, pageErrors }, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        cases: results.map(
          ({
            locale,
            viewport,
            heroContentFits,
            footerGap,
            aligned,
            noOverflow,
          }) => ({
            locale,
            viewport,
            heroContentFits,
            footerGap: Math.round(footerGap),
            aligned,
            noOverflow,
          }),
        ),
        hydrationErrors,
        pageErrors,
      },
      null,
      2,
    ),
  );
  for (const result of results) {
    const name =
      result.locale +
      " " +
      result.viewport.width +
      "x" +
      result.viewport.height;
    assert.ok(result.heroContentFits, name + ": hero overlaps or clips");
    assert.ok(result.aligned, name + ": gallery not aligned");
    assert.ok(result.noOverflow, name + ": horizontal overflow");
    assert.equal(result.extensionAttributes, 0);
  }
  assert.deepEqual(hydrationErrors, []);
  assert.deepEqual(pageErrors, []);
} finally {
  await send("Target.closeTarget", { targetId }, null).catch(() => {});
  socket.close();
}
