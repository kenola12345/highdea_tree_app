import { describe, expect, it } from "vitest";

import { isSafeNextPath } from "./urls";
import { toVideoEmbed } from "./videoEmbed";

describe("toVideoEmbed", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  ])("builds a fixed YouTube embed URL from %s", (url) => {
    expect(toVideoEmbed(url)).toEqual({
      provider: "youtube",
      videoId: "dQw4w9WgXcQ",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    });
  });

  it("builds a Vimeo embed URL", () => {
    expect(toVideoEmbed("https://vimeo.com/76979871")).toMatchObject({
      provider: "vimeo",
      src: "https://player.vimeo.com/video/76979871",
    });
  });

  it.each([
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "javascript:alert(1)",
    "https://www.youtube.com/watch?v=<script>",
    "not a url",
  ])("returns null for %s", (url) => {
    expect(toVideoEmbed(url)).toBeNull();
  });
});

describe("isSafeNextPath", () => {
  it("allows only paths on this site", () => {
    expect(isSafeNextPath("/trees/abc/edit")).toBe(true);
    expect(isSafeNextPath("//evil.example.com")).toBe(false);
    expect(isSafeNextPath("https://evil.example.com")).toBe(false);
    expect(isSafeNextPath(null)).toBe(false);
  });
});
