import { describe, expect, it } from "vitest";
import { extractOpenGraphImage } from "./page-image";

describe("extractOpenGraphImage", () => {
  it("reads og:image content", () => {
    const html = `
      <html><head>
        <meta property="og:image" content="https://cdn.example.com/salmon.jpg" />
      </head></html>
    `;
    expect(extractOpenGraphImage(html)).toBe(
      "https://cdn.example.com/salmon.jpg",
    );
  });

  it("reads reversed attribute order and twitter:image", () => {
    const html = `
      <meta content="https://cdn.example.com/dish.webp" name="twitter:image" />
    `;
    expect(extractOpenGraphImage(html)).toBe(
      "https://cdn.example.com/dish.webp",
    );
  });

  it("returns null when no usable image meta exists", () => {
    expect(extractOpenGraphImage("<html><body>no meta</body></html>")).toBeNull();
    expect(
      extractOpenGraphImage(
        `<meta property="og:image" content="javascript:alert(1)" />`,
      ),
    ).toBeNull();
  });
});
