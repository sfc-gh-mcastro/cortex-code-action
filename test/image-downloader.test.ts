import { describe, expect, it } from "bun:test";
import { extractImageUrls } from "../src/github/image-downloader";
import { replaceImageUrls } from "../src/github/replace-image-urls";

describe("extractImageUrls", () => {
  it("extracts URLs from markdown image syntax", () => {
    const body =
      "Here is a screenshot:\n![my screenshot](https://github.com/user-attachments/assets/abc123-def456)\nEnd.";
    const urls = extractImageUrls(body);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      "https://github.com/user-attachments/assets/abc123-def456"
    );
  });

  it("extracts URLs from HTML img tags", () => {
    const body =
      '<p>See image: <img src="https://github.com/user-attachments/assets/img-789" width="400"></p>';
    const urls = extractImageUrls(body);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe(
      "https://github.com/user-attachments/assets/img-789"
    );
  });

  it("extracts multiple images", () => {
    const body = [
      "![first](https://github.com/user-attachments/assets/aaa)",
      "![second](https://github.com/user-attachments/assets/bbb)",
    ].join("\n");
    const urls = extractImageUrls(body);
    expect(urls).toHaveLength(2);
  });

  it("deduplicates identical URLs", () => {
    const body = [
      "![one](https://github.com/user-attachments/assets/same)",
      "![two](https://github.com/user-attachments/assets/same)",
    ].join("\n");
    const urls = extractImageUrls(body);
    expect(urls).toHaveLength(1);
  });

  it("ignores non-GitHub-attachment URLs", () => {
    const body =
      "![logo](https://example.com/logo.png)\n![other](https://cdn.com/img.jpg)";
    const urls = extractImageUrls(body);
    expect(urls).toHaveLength(0);
  });

  it("ignores regular links (not images)", () => {
    const body =
      "[click here](https://github.com/user-attachments/assets/abc123)";
    const urls = extractImageUrls(body);
    expect(urls).toHaveLength(0);
  });

  it("returns empty for text without images", () => {
    const body = "Just a normal comment about fixing the bug.";
    const urls = extractImageUrls(body);
    expect(urls).toHaveLength(0);
  });
});

describe("replaceImageUrls", () => {
  it("replaces original URLs with local paths", () => {
    const text =
      "See ![screenshot](https://github.com/user-attachments/assets/abc) for details.";
    const map = new Map([
      [
        "https://github.com/user-attachments/assets/abc",
        "/tmp/github-images/image-123.png",
      ],
    ]);
    const result = replaceImageUrls(text, map);
    expect(result).toBe(
      "See ![screenshot](/tmp/github-images/image-123.png) for details."
    );
  });

  it("replaces multiple occurrences of the same URL", () => {
    const text =
      "![a](https://github.com/user-attachments/assets/x) and ![b](https://github.com/user-attachments/assets/x)";
    const map = new Map([
      [
        "https://github.com/user-attachments/assets/x",
        "/tmp/github-images/img.png",
      ],
    ]);
    const result = replaceImageUrls(text, map);
    expect(result).toBe(
      "![a](/tmp/github-images/img.png) and ![b](/tmp/github-images/img.png)"
    );
  });

  it("handles empty map (no replacements)", () => {
    const text = "No images here.";
    const map = new Map<string, string>();
    expect(replaceImageUrls(text, map)).toBe(text);
  });

  it("handles multiple different URLs", () => {
    const text = "![a](https://github.com/user-attachments/assets/1) ![b](https://github.com/user-attachments/assets/2)";
    const map = new Map([
      ["https://github.com/user-attachments/assets/1", "/tmp/github-images/img1.png"],
      ["https://github.com/user-attachments/assets/2", "/tmp/github-images/img2.jpg"],
    ]);
    const result = replaceImageUrls(text, map);
    expect(result).toBe("![a](/tmp/github-images/img1.png) ![b](/tmp/github-images/img2.jpg)");
  });
});
