const articleTitles = {
  "Argentinian empanada": "Empanada",
  "Hilsa curry": "Ilish curry",
  "La bandera": "La bandera (dish)",
  "Mac and cheese": "Macaroni and cheese",
  "Barbecue ribs": "Spare ribs",
  Doubles: "Doubles (food)",
  Griot: "Griot (food)",
  "Egg waffle": "Egg waffle",
  "Kottu roti": "Kottu",
};
// Specific source file confirmed against its description when dish-name search is ambiguous.
// Plated photos replace studio cut-outs on white for these dishes.
const fileOverrides = {
  "la-bandera": "File:BanderaDominicana01.jpg",
  croissant:
    "File:Coffee, croissants, and jam on a plate with cookies on a table during breakfast time in a cozy setting.jpg",
  cheeseburger: "File:Cheeseburger and steak fries at Rentier-Burger.jpg",
  jambalaya: "File:Jambalaya on plate.jpg",
};

const headers = {
  "User-Agent":
    "HackTheSkiesFoodCatalog/1.0 (food discovery catalog; public metadata import)",
};
const plainText = (value = "") =>
  String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const normalize = (value) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

async function queryApi(host, params, fetcher) {
  const url = new URL(`https://${host}/w/api.php`);
  url.search = new URLSearchParams({
    ...params,
    format: "json",
    formatversion: "2",
    maxlag: "5",
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetcher(url.href, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
    if ([429, 503].includes(response.status) && attempt < 3) {
      const retry = response.headers.get("retry-after");
      const seconds =
        retry && /^\d+$/.test(retry)
          ? Number(retry)
          : retry
            ? Math.max(0, (Date.parse(retry) - Date.now()) / 1000)
            : 30 * (attempt + 1);
      console.log(
        `Wikimedia requested a pause; retrying after ${Math.ceil(seconds)} seconds.`,
      );
      await new Promise((done) =>
        setTimeout(done, Math.max(1000, seconds * 1000)),
      );
      continue;
    }
    if (!response.ok)
      throw new Error(`Wikimedia returned HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`Wikimedia API error: ${data.error.code}`);
    return { ...data.query, pages: data.query?.pages ?? [] };
  }
}

function creditForFile(page) {
  const info = page.imageinfo?.[0];
  const meta = info?.extmetadata;
  if (
    !info ||
    !meta ||
    (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime))
  )
    return null;
  const url = info.thumburl || info.url;
  const sourceUrl = info.descriptionurl;
  const licenseName = plainText(meta.LicenseShortName?.value);
  let licenseUrl = meta.LicenseUrl?.value;
  if (!licenseUrl && /cc0/i.test(licenseName))
    licenseUrl = "https://creativecommons.org/publicdomain/zero/1.0/";
  else if (!licenseUrl && /public domain/i.test(licenseName))
    licenseUrl = "https://creativecommons.org/publicdomain/mark/1.0/";
  const artist = plainText(meta.Artist?.value || meta.Credit?.value);
  if (!url || !sourceUrl || !licenseName || !licenseUrl || !artist) return null;
  const imageUrl = new URL(url);
  if (
    imageUrl.protocol !== "https:" ||
    !["upload.wikimedia.org", "thumb.wikimedia.org"].includes(imageUrl.hostname)
  )
    return null;
  if (!/^https:\/\/(?:commons\.wikimedia\.org)\//.test(sourceUrl)) return null;
  licenseUrl = String(licenseUrl)
    .replace(/^\/\//, "https://")
    .replace(/^http:/, "https:");
  if (!/^https:\/\/(?:creativecommons\.org|www\.gnu\.org)\//.test(licenseUrl))
    return null;
  // Exclude noncommercial and no-derivatives licenses from this reusable catalog.
  if (/\bnc\b|\bnd\b/i.test(licenseName)) return null;
  return {
    url,
    source: "wikimedia",
    sourceUrl,
    photographer: artist,
    photographerUrl: null,
    licenseUrl,
    licenseName,
    attribution: `${artist} / Wikimedia Commons / ${licenseName}`,
    fileTitle: page.title,
    reviewed: false,
  };
}

export async function findCommonsPhoto(food, { fetcher = fetch } = {}) {
  if (fileOverrides[food.id]) {
    const { pages } = await queryApi(
      "commons.wikimedia.org",
      {
        action: "query",
        titles: fileOverrides[food.id],
        prop: "imageinfo",
        iiprop: "url|extmetadata|mime",
        iiurlwidth: "600",
      },
      fetcher,
    );
    const credit = pages.map(creditForFile).find(Boolean);
    if (credit)
      return {
        ...credit,
        matchMethod: "curated-dish-file",
        matchTitle: fileOverrides[food.id],
      };
  }
  const title = articleTitles[food.name] || food.name;
  const { pages } = await queryApi(
    "en.wikipedia.org",
    {
      action: "query",
      titles: title,
      redirects: "1",
      prop: "pageimages|pageprops",
      piprop: "name",
      pilicense: "free",
      ppprop: "disambiguation",
    },
    fetcher,
  );
  const article = pages.find(
    (page) =>
      !page.missing &&
      !(page.pageprops && "disambiguation" in page.pageprops) &&
      page.pageimage,
  );
  if (article) {
    const { pages: files } = await queryApi(
      "commons.wikimedia.org",
      {
        action: "query",
        titles: `File:${article.pageimage}`,
        prop: "imageinfo",
        iiprop: "url|extmetadata|mime",
        iiurlwidth: "600",
      },
      fetcher,
    );
    const credit = files.map(creditForFile).find(Boolean);
    if (credit)
      return {
        ...credit,
        matchMethod: "dish-article",
        matchTitle: article.title,
      };
  }
  // Narrow file-title matching plus food-category evidence avoids unrelated namesakes.
  const names = [...new Set([food.name, title])];
  for (const name of names) {
    const { pages: files } = await queryApi(
      "commons.wikimedia.org",
      {
        action: "query",
        generator: "search",
        gsrsearch: `intitle:"${name.replace(/["\\]/g, " ")}" filetype:bitmap`,
        gsrnamespace: "6",
        gsrlimit: "8",
        prop: "imageinfo",
        iiprop: "url|extmetadata|mime",
        iiurlwidth: "600",
      },
      fetcher,
    );
    const match = files
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .find((page) => {
        const categories = plainText(
          page.imageinfo?.[0]?.extmetadata?.Categories?.value,
        );
        return (
          normalize(page.title).includes(normalize(name)) &&
          /food|cuisine|dish|cooking|meal|soup|noodle|pastr|bread|rice|dessert|salad|meat|chicken|beef|pork|sandwich|cake|stew/i.test(
            categories,
          ) &&
          creditForFile(page)
        );
      });
    if (match)
      return {
        ...creditForFile(match),
        matchMethod: "dish-file-title",
        matchTitle: match.title,
      };
  }
  return null;
}

export async function findCommonsPhotos(
  foods,
  { fetcher = fetch, onProgress = () => {} } = {},
) {
  const result = new Map();
  for (let offset = 0; offset < foods.length; offset += 40) {
    const batch = foods.slice(offset, offset + 40);
    const articles = await queryApi(
      "en.wikipedia.org",
      {
        action: "query",
        titles: batch
          .map((food) => articleTitles[food.name] || food.name)
          .join("|"),
        redirects: "1",
        prop: "pageimages|pageprops",
        piprop: "name",
        pilicense: "free",
        ppprop: "disambiguation",
      },
      fetcher,
    );
    const aliases = new Map(
      [...(articles.normalized ?? []), ...(articles.redirects ?? [])].map(
        (item) => [item.from, item.to],
      ),
    );
    const canonical = (value) => {
      const seen = new Set();
      while (aliases.has(value) && !seen.has(value)) {
        seen.add(value);
        value = aliases.get(value);
      }
      return value;
    };
    const pagesByTitle = new Map(
      articles.pages.map((page) => [page.title, page]),
    );
    const filesToFoods = new Map();
    for (const food of batch) {
      if (fileOverrides[food.id]) {
        filesToFoods.set(fileOverrides[food.id], [
          { food, article: fileOverrides[food.id], curated: true },
        ]);
        continue;
      }
      const page = pagesByTitle.get(
        canonical(articleTitles[food.name] || food.name),
      );
      if (
        !page?.pageimage ||
        page.missing ||
        (page.pageprops && "disambiguation" in page.pageprops)
      )
        continue;
      const fileTitle = `File:${page.pageimage}`.replace(/_/g, " ");
      filesToFoods.set(fileTitle, [
        ...(filesToFoods.get(fileTitle) ?? []),
        { food, article: page.title },
      ]);
    }
    if (filesToFoods.size) {
      const { pages: files } = await queryApi(
        "commons.wikimedia.org",
        {
          action: "query",
          titles: [...filesToFoods.keys()].join("|"),
          prop: "imageinfo",
          iiprop: "url|extmetadata|mime",
          iiurlwidth: "600",
        },
        fetcher,
      );
      for (const page of files) {
        const credit = creditForFile(page);
        if (!credit) continue;
        for (const match of filesToFoods.get(page.title.replace(/_/g, " ")) ??
          [])
          result.set(match.food.id, {
            ...credit,
            matchMethod: match.curated ? "curated-dish-file" : "dish-article",
            matchTitle: match.article,
          });
      }
    }
    onProgress(
      `Matched ${result.size} Wikimedia photos using batched dish articles.`,
    );
  }
  for (const food of foods.filter((food) => !result.has(food.id))) {
    onProgress(`Looking for the remaining photo: ${food.name}.`);
    const image = await findCommonsPhoto(food, { fetcher });
    if (image) result.set(food.id, image);
  }
  return result;
}
