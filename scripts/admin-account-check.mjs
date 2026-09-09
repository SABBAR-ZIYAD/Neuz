import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const base = "http://localhost:3001";
const access = await readFile("tmp/admin-access.txt", "utf8");
const password = access.match(/^Mot de passe: (.+)$/m)[1];
const username = process.env.ADMIN_USERNAME || "admin";
const changedPassword = randomBytes(4).toString("hex");
const browser = await chromium.launch({channel: "chrome", headless: true});
const context = await browser.newContext({viewport: {width:390,height:844}});
let changed = false;
async function login(user, pass) {
  return context.request.post(base+"/api/admin/login", {headers:{origin:base},data:{username:user,password:pass}});
}
try {
  assert.equal((await login(username,password)).status(),200,"Initial login");
  const oldCookie = (await context.cookies()).find(c=>c.name==="neuz_admin").value;
  const page = await context.newPage();
  await page.goto(base+"/admin");
  await page.getByRole("link",{name:"Mon compte",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Mon compte"})).toBeVisible();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const axe = await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
  assert.deepEqual(axe.violations.map(v=>v.id),[]);
  await page.getByLabel("Identifiant",{exact:true}).fill("test-owner");
  await page.getByLabel("Mot de passe actuel",{exact:true}).fill(password);
  await page.getByLabel("Nouveau mot de passe",{exact:true}).fill(changedPassword);
  await page.getByLabel("Confirmer le nouveau mot de passe",{exact:true}).fill(changedPassword);
  for (const label of ["Mot de passe actuel", "Nouveau mot de passe", "Confirmer le nouveau mot de passe"]) {
    const input = page.getByLabel(label, {exact:true});
    await expect(input).toHaveAttribute("type", "password");
    await page.getByRole("button", {name:"Afficher : " + label, exact:true}).click();
    await expect(input).toHaveAttribute("type", "text");
    await page.getByRole("button", {name:"Masquer : " + label, exact:true}).click();
    await expect(input).toHaveAttribute("type", "password");
  }
  const response = page.waitForResponse(r=>r.url().endsWith("/api/admin/account") && r.request().method()==="POST");
  await page.getByRole("button",{name:"Enregistrer les identifiants"}).click();
  assert.equal((await response).status(),200,"Change account"); changed=true;
  await expect(page.getByRole("status")).toContainText("modifiés");
  assert.equal((await context.request.get(base+"/api/admin/catalog")).status(),401);
  const stale = await fetch(base+"/api/admin/catalog",{headers:{cookie:"neuz_admin="+oldCookie}});
  assert.equal(stale.status,401,"Old session is revoked");
  assert.equal((await login(username,password)).status(),401,"Seed password no longer works");
  assert.equal((await login("test-owner",changedPassword)).status(),200,"New login works");
  const catalog=await context.request.get(base+"/api/admin/catalog").then(r=>r.json());
  assert.equal(JSON.stringify(catalog).includes("passwordHash"),false);
  const publicHtml=await context.request.get(base+"/fr").then(r=>r.text());
  assert.equal(publicHtml.includes("passwordHash"),false);
  await page.goto(base+"/admin/account");
  await expect(page.getByLabel("Identifiant",{exact:true})).toHaveValue("test-owner");
  console.log("Passed: account page, mobile accessibility, credential change, new login, old password/session rejection, no credential exposure.");
} finally {
  if(changed){
    await login("test-owner",changedPassword);
    const restored=await context.request.post(base+"/api/admin/account",{headers:{origin:base},data:{username,currentPassword:changedPassword,newPassword:password,confirmPassword:password}});
    assert.equal(restored.status(),200,"Restore isolated credentials");
  }
  await browser.close();
}
