import assert from "node:assert/strict";
const base = process.env.SEO_TEST_URL || "http://127.0.0.1:3000";
const origin = process.env.SITE_URL || "http://localhost:3000";
const publicSite = origin.startsWith("https:");
const sitemap = await fetch(base + "/sitemap.xml").then((r) => r.text());
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(
  (match) => match[1],
);
assert.ok(urls.length >= 6 && urls.length % 3 === 0);
assert.equal(new Set(urls).size, urls.length);
const titles = new Set();
for (const url of urls) {
  assert.ok(url.startsWith(origin + "/"));
  const path = new URL(url).pathname;
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  const visible = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  assert.ok(!visible.includes("MISSING_MESSAGE"), path);
  assert.ok(!visible.includes("INVALID_MESSAGE"), path);
  assert.ok(!visible.includes("???"), path);
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  assert.ok(title, path);
  titles.add(title);
  assert.ok(html.includes('rel="canonical" href="' + url + '"'), path);
  assert.ok(
    html.includes(
      'name="robots" content="' +
        (publicSite ? "index" : "noindex") +
        ', follow"',
    ),
    path,
  );
  assert.equal([...visible.matchAll(/<h1\b/g)].length, 1, path);
  assert.equal(
    [...html.matchAll(/rel="alternate" hrefLang=/g)].length,
    4,
    path,
  );
  assert.ok(!(response.headers.get("link") || "").includes("hreflang"), path);
  const schemas = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ].map((m) => JSON.parse(m[1]));
  if (path.includes("/creations/")) {
    assert.ok(
      schemas[0]["@graph"].some((entry) => entry["@type"] === "Service"),
      path,
    );
    assert.ok(
      schemas[0]["@graph"].some((entry) => entry["@type"] === "BreadcrumbList"),
      path,
    );
    assert.ok(visible.includes("<article"), path);
  }
}
assert.equal(titles.size, urls.length);
const robots = await fetch(base + "/robots.txt").then((r) => r.text());
assert.ok(robots.includes("Sitemap: " + origin + "/sitemap.xml"));
assert.ok(
  publicSite
    ? robots.includes("Allow: /\nDisallow: /api/")
    : robots.includes("Disallow: /\n"),
);
for (const path of [
  "/fr/creations/does-not-exist",
  "/fr/does-not-exist",
  "/zz/creations/bespoke-rugs",
]) {
  assert.equal((await fetch(base + path)).status, 404, path);
}
console.log(
  "Passed: sitemap pages, unique titles, canonical URLs, hreflang, robots, server-rendered content, JSON-LD and 404 responses.",
);
