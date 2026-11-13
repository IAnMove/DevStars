import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidUsername } from "../src/lib/username.ts";

test("acepta logins válidos", () => {
  const valid = [
    "a",
    "7",
    "octocat",
    "Octo-Cat",
    "a-b",
    "a1-b2-c3",
    "a".repeat(39),
  ];
  for (const login of valid) {
    assert.equal(isValidUsername(login), true, `debería ser válido: ${login}`);
  }
});

test("rechaza vacío y longitud > 39", () => {
  assert.equal(isValidUsername(""), false);
  assert.equal(isValidUsername("a".repeat(40)), false);
});

test("rechaza guiones al inicio, al final o dobles", () => {
  for (const login of ["-a", "a-", "-", "a--b", "--"]) {
    assert.equal(isValidUsername(login), false, `debería ser inválido: ${login}`);
  }
});

test("rechaza puntos, espacios, barras y saltos de línea", () => {
  for (const login of ["a.b", "a b", " a", "a/b", "a_b", "a\n", "ñandú"]) {
    assert.equal(isValidUsername(login), false, `debería ser inválido: ${JSON.stringify(login)}`);
  }
});

test("rechaza logins con extensión de fichero", () => {
  for (const login of ["octocat.png", "octocat.json", "octocat.svg", "favicon.ico"]) {
    assert.equal(isValidUsername(login), false, `debería ser inválido: ${login}`);
  }
});

test("rechaza valores que no son cadenas", () => {
  for (const value of [undefined, null, 123, {}, [], ["octocat"]]) {
    assert.equal(isValidUsername(value), false);
  }
});
