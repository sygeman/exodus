import { describe, it, expect } from "bun:test";
import { isWildcard, splitSegments, matchPattern } from "./utils";

describe("isWildcard", () => {
  it("should return true for patterns with *", () => {
    expect(isWildcard("user:*")).toBe(true);
    expect(isWildcard("user:**")).toBe(true);
    expect(isWildcard("*")).toBe(true);
    expect(isWildcard("**")).toBe(true);
    expect(isWildcard("*:*")).toBe(true);
  });

  it("should return false for exact names", () => {
    expect(isWildcard("user:login")).toBe(false);
    expect(isWildcard("user")).toBe(false);
    expect(isWildcard("")).toBe(false);
  });
});

describe("splitSegments", () => {
  it("should split by colon", () => {
    expect(splitSegments("user:login")).toEqual(["user", "login"]);
    expect(splitSegments("a:b:c:d")).toEqual(["a", "b", "c", "d"]);
  });

  it("should return single segment for no colon", () => {
    expect(splitSegments("user")).toEqual(["user"]);
  });

  it("should handle empty string", () => {
    expect(splitSegments("")).toEqual([""]);
  });
});

describe("matchPattern", () => {
  describe("exact match", () => {
    it("should match identical segments", () => {
      expect(matchPattern(["user", "login"], ["user", "login"])).toBe(true);
    });

    it("should not match different segments", () => {
      expect(matchPattern(["user", "login"], ["user", "logout"])).toBe(false);
      expect(matchPattern(["user", "login"], ["admin", "login"])).toBe(false);
    });

    it("should not match different lengths", () => {
      expect(matchPattern(["user", "login"], ["user"])).toBe(false);
      expect(matchPattern(["user"], ["user", "login"])).toBe(false);
    });
  });

  describe("* wildcard", () => {
    it("should match single segment", () => {
      expect(matchPattern(["user", "login"], ["user", "*"])).toBe(true);
      expect(matchPattern(["user", "logout"], ["user", "*"])).toBe(true);
    });

    it("should match at start", () => {
      expect(matchPattern(["user", "login"], ["*", "login"])).toBe(true);
      expect(matchPattern(["admin", "login"], ["*", "login"])).toBe(true);
    });

    it("should match in middle", () => {
      expect(matchPattern(["user", "123", "update"], ["user", "*", "update"])).toBe(true);
    });

    it("should not match multiple segments", () => {
      expect(matchPattern(["user", "profile", "update"], ["user", "*"])).toBe(false);
    });

    it("should not match empty", () => {
      expect(matchPattern([], ["*"])).toBe(false);
    });
  });

  describe("** wildcard", () => {
    it("should match any segments at end", () => {
      expect(matchPattern(["user", "login"], ["user", "**"])).toBe(true);
      expect(matchPattern(["user", "profile", "update"], ["user", "**"])).toBe(true);
      expect(matchPattern(["user"], ["user", "**"])).toBe(true);
    });

    it("should match from start", () => {
      expect(matchPattern(["user", "login"], ["**", "login"])).toBe(true);
      expect(matchPattern(["a", "b", "c", "login"], ["**", "login"])).toBe(true);
    });

    it("should match in middle", () => {
      expect(matchPattern(["user", "123", "update"], ["user", "**", "update"])).toBe(true);
      expect(matchPattern(["user", "a", "b", "c", "update"], ["user", "**", "update"])).toBe(
        true,
      );
    });

    it("should match everything", () => {
      expect(matchPattern(["user", "login"], ["**"])).toBe(true);
      expect(matchPattern([], ["**"])).toBe(true);
    });
  });

  describe("combined wildcards", () => {
    it("should handle *:** combination", () => {
      expect(matchPattern(["user", "login"], ["*", "**"])).toBe(true);
      expect(matchPattern(["user", "profile", "update"], ["*", "**"])).toBe(true);
    });
  });
});
