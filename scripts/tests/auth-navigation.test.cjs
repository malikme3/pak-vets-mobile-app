const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/utils/authNavigation.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: exportsObject },
);
const { getAuthRedirect } = exportsObject;

test("signed-out users land on Farm Vitals and cannot stay on protected screens", () => {
  for (const route of [
    undefined,
    "index",
    "case-detail",
    "create-animal",
    "(tabs)",
  ]) {
    assert.equal(getAuthRedirect("signedOut", route), "/farm-vitals");
  }
});

test("the public preview, sign-in, and OAuth callbacks remain reachable", () => {
  for (const route of [
    "farm-vitals",
    "create-farm",
    "farm-dashboard",
    "add-farm-animal",
    "farm-animal",
    "farm-photos",
    "add-farm-history",
    "farm-history",
    "login",
    "auth",
    "oauthredirect",
    "expo-auth-session",
  ]) {
    assert.equal(getAuthRedirect("signedOut", route), null);
  }
});

test("loading sessions do not redirect and signed-in users retain their dashboard", () => {
  assert.equal(getAuthRedirect("loading", undefined), null);
  assert.equal(getAuthRedirect("loading", "farm-vitals"), null);
  assert.equal(getAuthRedirect("signedIn", "farm-vitals"), "/");
  assert.equal(getAuthRedirect("signedIn", "case-detail"), null);
  assert.equal(getAuthRedirect("signedIn", undefined), null);
});
