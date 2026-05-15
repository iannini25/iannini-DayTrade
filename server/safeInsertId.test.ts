import { describe, it, expect } from "vitest";
import { safeInsertId } from "./db";

describe("safeInsertId", () => {
  it("extrai number de { insertId: number }", () => {
    expect(safeInsertId({ insertId: 42 })).toBe(42);
  });

  it("converte bigint para number (TiDB/alguns MySQL)", () => {
    expect(safeInsertId({ insertId: 123n })).toBe(123);
  });

  it("converte string numérica", () => {
    expect(safeInsertId({ insertId: "77" })).toBe(77);
  });

  it("retorna NaN para insertId undefined", () => {
    expect(Number.isNaN(safeInsertId({}))).toBe(true);
    expect(Number.isNaN(safeInsertId({ insertId: undefined }))).toBe(true);
    expect(Number.isNaN(safeInsertId({ insertId: null }))).toBe(true);
  });

  it("retorna NaN para resultado totalmente vazio", () => {
    expect(Number.isNaN(safeInsertId(undefined))).toBe(true);
    expect(Number.isNaN(safeInsertId(null))).toBe(true);
  });

  it("lê insertId de array result[0] (formato mysql2)", () => {
    expect(safeInsertId([{ insertId: 99 }])).toBe(99);
  });

  it("retorna NaN para insertId não numérico", () => {
    expect(Number.isNaN(safeInsertId({ insertId: "abc" }))).toBe(true);
  });
});
