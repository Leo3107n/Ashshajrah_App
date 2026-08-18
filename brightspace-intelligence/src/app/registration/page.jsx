import { redirect } from "next/navigation";

export default async function RegistrationRedirectPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const query = new URLSearchParams();

  Object.entries(resolvedSearchParams || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value) {
      query.set(key, value);
    }
  });

  redirect(`/admission-form${query.toString() ? `?${query.toString()}` : ""}`);
}
