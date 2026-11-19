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
    "farm-board",
    "add-farm-animal",
    "farm-animal",
    "farm-photos",
    "add-farm-history",
    "farm-history",
    "animal-case-dashboard",
    "health-case",
    "health-case-detail",
    "login",
    "auth",
    "oauthredirect",
    "expo-auth-session",
  ]) {
    assert.equal(getAuthRedirect("signedOut", route), null);
  }
});

test("loading and signed-in sessions can stay on Farm Vitals", () => {
  assert.equal(getAuthRedirect("loading", undefined), null);
  assert.equal(getAuthRedirect("loading", "farm-vitals"), null);
  assert.equal(getAuthRedirect("signedIn", "farm-vitals"), null);
  assert.equal(getAuthRedirect("signedIn", "case-detail"), null);
  assert.equal(getAuthRedirect("signedIn", undefined), null);
});
