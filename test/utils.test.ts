import { describe, expect, it } from "bun:test";
import { generateBranchName } from "../src/utils/branch";
import {
  sanitizeContent,
  stripInvisibleCharacters,
  stripMarkdownImageAltText,
} from "../src/utils/sanitize";

describe("generateBranchName", () => {
  it("generates a valid branch name", () => {
    const name = generateBranchName({
      prefix: "cortex-code/",
      entityType: "pr",
      entityNumber: 42,
    });
    expect(name).toMatch(/^cortex-code\/pr-42-\d+$/);
  });

  it("uses issue entity type", () => {
    const name = generateBranchName({
      prefix: "cortex-code/",
      entityType: "issue",
      entityNumber: 7,
    });
    expect(name).toMatch(/^cortex-code\/issue-7-\d+$/);
  });
});

describe("sanitizeContent", () => {
  it("redacts GitHub personal access tokens", () => {
    const input = "Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
    expect(sanitizeContent(input)).toContain("[REDACTED]");
    expect(sanitizeContent(input)).not.toContain("ghp_");
  });

  it("redacts GitHub App installation tokens", () => {
    const input = "ghs_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
    expect(sanitizeContent(input)).toContain("[REDACTED]");
  });

  it("leaves normal text unchanged", () => {
    const input = "This is a normal comment about a pull request.";
    expect(sanitizeContent(input)).toBe(input);
  });

  it("preserves code suggestion blocks", () => {
    const input = "Try this:\n```suggestion\nconst x = 1;\n```";
    expect(sanitizeContent(input)).toBe(input);
  });
});

describe("stripInvisibleCharacters", () => {
  it("removes zero-width space", () => {
    const input = "hello\u200Bworld";
    expect(stripInvisibleCharacters(input)).toBe("helloworld");
  });

  it("removes bidi override characters", () => {
    const input = "normal\u202Etext";
    expect(stripInvisibleCharacters(input)).toBe("normaltext");
  });

  it("removes soft hyphen", () => {
    const input = "soft\u00ADhyphen";
    expect(stripInvisibleCharacters(input)).toBe("softhyphen");
  });

  it("preserves tabs and newlines", () => {
    const input = "line1\n\tline2\r\n";
    expect(stripInvisibleCharacters(input)).toBe("line1\n\tline2\r\n");
  });
});

describe("stripMarkdownImageAltText", () => {
  it("strips alt text from markdown images", () => {
    const input = "![hidden instructions here](https://example.com/img.png)";
    expect(stripMarkdownImageAltText(input)).toBe(
      "![](https://example.com/img.png)"
    );
  });

  it("leaves non-image links unchanged", () => {
    const input = "[click here](https://example.com)";
    expect(stripMarkdownImageAltText(input)).toBe(input);
  });
});
