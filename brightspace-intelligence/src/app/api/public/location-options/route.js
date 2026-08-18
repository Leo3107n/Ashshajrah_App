import { NextResponse } from "next/server";

async function readJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, data };
}

function normalizeList(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const country = String(searchParams.get("country") || "").trim();

  try {
    if (country) {
      const { data } = await readJson(`https://countriesnow.space/api/v0.1/countries/cities/q?country=${encodeURIComponent(country)}`);
      const cities = normalizeList(data?.data);
      return NextResponse.json({ country, cities }, { status: 200 });
    }

    const { data } = await readJson("https://countriesnow.space/api/v0.1/countries");
    const countries = normalizeList(
      Array.isArray(data?.data)
        ? data.data.map((item) => item?.country)
        : Array.isArray(data?.data?.countries)
          ? data.data.countries
          : []
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({ countries }, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        countries: [],
        cities: [],
      },
      { status: 200 },
    );
  }
}
