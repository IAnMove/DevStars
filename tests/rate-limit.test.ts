import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SlidingWindowLimiter,
  getClientIp,
  normalizeIp,
} from "../src/lib/rate-limit.ts";

test("permite hasta el límite y bloquea el siguiente con retryAfter", () => {
  const limiter = new SlidingWindowLimiter([{ limit: 3, windowMs: 1000 }]);
  assert.deepEqual(limiter.consume("k", 0), { ok: true });
  assert.deepEqual(limiter.consume("k", 1), { ok: true });
  assert.deepEqual(limiter.consume("k", 2), { ok: true });
  assert.deepEqual(limiter.consume("k", 3), { ok: false, retryAfterSec: 1 });
});

test("la ventana se desliza: tras expirar el primer hit vuelve a permitir", () => {
  const limiter = new SlidingWindowLimiter([{ limit: 3, windowMs: 1000 }]);
  limiter.consume("k", 0);
  limiter.consume("k", 1);
  limiter.consume("k", 2);
  assert.equal(limiter.consume("k", 999).ok, false);
  assert.equal(limiter.consume("k", 1000).ok, true);
});

test("las claves son independientes", () => {
  const limiter = new SlidingWindowLimiter([{ limit: 1, windowMs: 1000 }]);
  assert.equal(limiter.consume("a", 0).ok, true);
  assert.equal(limiter.consume("a", 1).ok, false);
  assert.equal(limiter.consume("b", 1).ok, true);
});

test("con varias reglas manda la más restrictiva y los bloqueos no cuentan como hit", () => {
  const limiter = new SlidingWindowLimiter([
    { limit: 2, windowMs: 1000 },
    { limit: 3, windowMs: 10_000 },
  ]);
  assert.equal(limiter.consume("k", 0).ok, true);
  assert.equal(limiter.consume("k", 500).ok, true);
  // Regla corta: libera hueco en 400 ms => 1 s
  assert.deepEqual(limiter.consume("k", 600), { ok: false, retryAfterSec: 1 });
  assert.equal(limiter.consume("k", 1000).ok, true);
  // Regla larga: 3 hits en 10 s, el más antiguo (t=0) caduca en 8400 ms => 9 s
  assert.deepEqual(limiter.consume("k", 1600), { ok: false, retryAfterSec: 9 });
});

test("tope de memoria: nunca supera maxKeys claves", () => {
  const limiter = new SlidingWindowLimiter([{ limit: 5, windowMs: 60_000 }], 3);
  for (let i = 0; i < 50; i++) limiter.consume(`ip-${i}`, i);
  assert.equal(limiter.size, 3);
});

test("al llegar al tope se expulsa la clave menos reciente (LRU)", () => {
  const limiter = new SlidingWindowLimiter([{ limit: 1, windowMs: 10_000 }], 3);
  limiter.consume("a", 0);
  limiter.consume("b", 0);
  limiter.consume("c", 0);
  assert.equal(limiter.consume("a", 1).ok, false); // a pasa a ser la más reciente
  assert.equal(limiter.consume("d", 1).ok, true); // expulsa b
  assert.equal(limiter.size, 3);
  assert.equal(limiter.consume("a", 2).ok, false); // a sigue recordada
  assert.equal(limiter.consume("b", 2).ok, true); // b fue olvidada
});

test("el barrido periódico elimina claves caducadas", () => {
  const limiter = new SlidingWindowLimiter([{ limit: 1, windowMs: 1000 }]);
  for (let i = 0; i < 499; i++) limiter.consume(`ip-${i}`, 0);
  assert.equal(limiter.size, 499);
  // La llamada nº 500 dispara el barrido; todas las anteriores han caducado
  limiter.consume("nuevo", 100_000);
  assert.equal(limiter.size, 1);
});

test("normalizeIp: IPv4, IPv4 mapeada, IPv6 a /64 y basura", () => {
  assert.equal(normalizeIp("203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeIp("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(normalizeIp("2001:db8:0:1::5"), "2001:db8:0:1::/64");
  assert.equal(normalizeIp("2001:db8:0:1:aaaa:bbbb:cccc:dddd"), "2001:db8:0:1::/64");
  assert.equal(normalizeIp("no-es-una-ip"), null);
  assert.equal(normalizeIp(""), null);
  assert.equal(normalizeIp(null), null);
});

test("getClientIp: prioridad CF-Connecting-IP > X-Forwarded-For > unknown", () => {
  const both = new Headers({
    "cf-connecting-ip": "198.51.100.1",
    "x-forwarded-for": "203.0.113.9, 10.0.0.1",
  });
  assert.equal(getClientIp(both), "198.51.100.1");

  const xff = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
  assert.equal(getClientIp(xff), "203.0.113.9");

  assert.equal(getClientIp(new Headers()), "unknown");
});
