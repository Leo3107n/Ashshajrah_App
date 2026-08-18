"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { jsPDF } from "jspdf";
import PaginationControls from "@/components/teacher/PaginationControls";
import { ChevronDown, Download, Search } from "lucide-react";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

const PAGE_SIZE = 7;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function textOrDash(value) {
  const text = String(value || "").trim();
  return text || "-";
}

function truncate(value, maxLength = 72) {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function prettyLabel(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatResponseValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "object" && item !== null ? JSON.stringify(item) : String(item)))
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function formatFlatObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return formatResponseValue(value);
  }

  const entries = Object.entries(value).filter(
    ([, nestedValue]) => nestedValue !== null && nestedValue !== undefined && String(nestedValue).trim() !== ""
  );

  if (!entries.length) {
    return "-";
  }

  if (entries.length === 1) {
    const [onlyKey, onlyValue] = entries[0];
    if (["answer", "value", "response"].includes(String(onlyKey).toLowerCase())) {
      return formatResponseValue(onlyValue);
    }
  }

  return entries
    .map(([nestedKey, nestedValue]) => {
      const key = String(nestedKey || "").toLowerCase();
      if (["answer", "value", "response"].includes(key)) {
        return formatResponseValue(nestedValue);
      }
      return `${prettyLabel(nestedKey)}: ${formatResponseValue(nestedValue)}`;
    })
    .filter(Boolean)
    .join(" | ");
}

export default function ParentInterviewFormsPanel({
  apiUrl = "/api/admin/parent-interview-forms",
  initialItems = null,
  portalTargetId = "admin-page-portal-root",
}) {
  const [state, setState] = useState({
    loading: !Array.isArray(initialItems),
    error: "",
    items: Array.isArray(initialItems) ? initialItems : [],
  });
  const [search, setSearch] = useState("");
  const [columnFilter, setColumnFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [downloadingId, setDownloadingId] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const responseSummary = useMemo(() => {
    const responses = selectedResponse?.responses;
    if (!responses || typeof responses !== "object") {
      return { pairs: [], version: selectedResponse?.form_version || "-" };
    }

    const questionsSource =
      responses.Questions ||
      responses.questions ||
      responses.question ||
      responses.FormQuestions ||
      {};
    const answersSource =
      responses.Answers ||
      responses.answers ||
      responses.answer ||
      responses.FormAnswers ||
      responses;

    const questionMap = questionsSource && typeof questionsSource === "object" ? questionsSource : {};
    const answerMap = answersSource && typeof answersSource === "object" ? answersSource : {};

    const answerKeys = Object.keys(answerMap).filter(
      (key) => !["questions", "answers", "formversion", "form_version"].includes(String(key).toLowerCase())
    );

    const questionOrder = answerKeys.length ? answerKeys : Object.keys(questionMap);

    const pairs = questionOrder.map((key) => {
      const questionMeta = questionMap[key] || {};
      const questionLabelValue =
        questionMeta.Label ||
        questionMeta.label ||
        questionMeta.question ||
        questionMeta.text ||
        questionMap[key] ||
        key;
      const answerValue = answerMap[key];
      return {
        key,
        questionNumber: String(key).replace(/^q/i, "").replace(/^question/i, "").trim(),
        question: prettyLabel(questionLabelValue),
        answer: answerValue,
      };
    });

    return { pairs, version: selectedResponse?.form_version || responses.FormVersion || responses.form_version || "-" };
  }, [selectedResponse]);

  useEffect(() => {
    setPage(1);
  }, [search, columnFilter]);

  function buildPdfLines(item) {
    const response = item?.responses;
    const summary = item
      ? [
          ["Registration ID", textOrDash(item.registration_id)],
          ["Parent Name", textOrDash(item.parent_name)],
          ["Parent Email", textOrDash(item.parent_email)],
          ["Child Name", textOrDash(item.child_name)],
          ["Child Age", textOrDash(item.child_age)],
          ["Interested Programme", textOrDash(item.interested_programme)],
          ["Status", textOrDash(item.status)],
          ["Submitted At", formatDate(item.submitted_at || item.created_at)],
          ["Form Version", textOrDash(item.form_version)],
        ]
      : [];

    const answerBlock = responseSummaryForItem(response, item?.form_version);

    return {
      summary,
      answerBlock,
    };
  }

  function responseSummaryForItem(responses, fallbackVersion = "-") {
    if (!responses || typeof responses !== "object") {
      return { pairs: [], version: fallbackVersion || "-" };
    }

    const questionsSource =
      responses.Questions ||
      responses.questions ||
      responses.question ||
      responses.FormQuestions ||
      {};
    const answersSource =
      responses.Answers ||
      responses.answers ||
      responses.answer ||
      responses.FormAnswers ||
      responses;

    const questionMap = questionsSource && typeof questionsSource === "object" ? questionsSource : {};
    const answerMap = answersSource && typeof answersSource === "object" ? answersSource : {};

    const answerKeys = Object.keys(answerMap).filter(
      (key) => !["questions", "answers", "formversion", "form_version"].includes(String(key).toLowerCase())
    );

    const questionOrder = answerKeys.length ? answerKeys : Object.keys(questionMap);

    const pairs = questionOrder.map((key) => {
      const questionMeta = questionMap[key] || {};
      const questionLabelValue =
        questionMeta.Label ||
        questionMeta.label ||
        questionMeta.question ||
        questionMeta.text ||
        questionMap[key] ||
        key;
      const answerValue = answerMap[key];
      return {
        key,
        questionNumber: String(key).replace(/^q/i, "").replace(/^question/i, "").trim(),
        question: prettyLabel(questionLabelValue),
        answer: answerValue,
      };
    });

    return { pairs, version: fallbackVersion || responses.FormVersion || responses.form_version || "-" };
  }

  function normalizePdfText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
  }

  function downloadParentInterviewPdf(item) {
    if (!item) return;

    setDownloadingId(item.id);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const marginX = 40;
      let y = 44;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - marginX * 2;

      const addLine = (text, size = 11, bold = false, color = [6, 63, 50]) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(normalizePdfText(text), maxWidth);
        lines.forEach((line) => {
          if (y > pageHeight - 40) {
            doc.addPage();
            y = 44;
          }
          doc.text(line, marginX, y);
          y += size + 6;
        });
      };

      const addSectionTitle = (text) => {
        y += 2;
        addLine(text, 13, true, [13, 92, 72]);
      };

      const addDivider = () => {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 44;
        }
        doc.setDrawColor(45, 138, 106);
        doc.setLineWidth(0.7);
        doc.line(marginX, y, pageWidth - marginX, y);
        y += 14;
      };

      addLine("Ash-Shajrah Learning Hub", 16, true, [6, 63, 50]);
      addLine("Parent Interview Form", 14, true, [13, 92, 72]);
      addLine(`Generated for: ${item.parent_name || "-"}`, 11, false, [36, 92, 79]);
      addLine(`Submitted: ${formatDate(item.submitted_at || item.created_at)}`, 11, false, [36, 92, 79]);
      addDivider();

      addSectionTitle("Record Details");
      buildPdfLines(item).summary.forEach(([label, value]) => {
        addLine(`${label}: ${value}`, 11, false, [36, 92, 79]);
      });

      if (item.responses && typeof item.responses === "object") {
        addDivider();
        addSectionTitle("Questions & Answers");
        const pdfSummary = responseSummaryForItem(item.responses, item.form_version);
        pdfSummary.pairs.forEach((entry, index) => {
          addLine(`Question #${entry.questionNumber || index + 1}: ${entry.question}`, 11, true, [13, 92, 72]);
          addLine(`Answer: ${formatFlatObject(entry.answer)}`, 11, false, [36, 92, 79]);
          y += 6;
        });
      }

      const fileName = `parent-interview-${String(item.parent_name || "record").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
      doc.save(fileName);
    } finally {
      setDownloadingId("");
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({
        ...current,
        loading: Array.isArray(initialItems) ? current.loading : true,
        error: "",
      }));
      try {
        const response = await fetch(apiUrl, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Unable to load parent interview forms.");
        }
        if (active) {
          setState({ loading: false, error: "", items: Array.isArray(data.items) ? data.items : [] });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : "Unable to load parent interview forms.",
            items: [],
          });
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [apiUrl, initialItems]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const submittedItems = state.items.filter((item) => {
      const response = item.responses;
      if (response === null || response === undefined || response === "") return false;
      if (typeof response === "object") {
        if (Array.isArray(response)) return response.length > 0;
        return Object.keys(response).length > 0;
      }
      return String(response).trim().length > 0;
    });

    if (!query) return submittedItems;
    return submittedItems.filter((item) => {
      const searchableMap = {
        registration_id: item.registration_id,
        parent_name: item.parent_name,
        parent_email: item.parent_email,
        child_name: item.child_name,
        child_age: item.child_age,
        interested_programme: item.interested_programme,
        status: item.status,
        submitted_at: formatDate(item.submitted_at || item.created_at),
        responses: item.responses ? JSON.stringify(item.responses) : "",
      };

      const searchableValue =
        columnFilter === "all"
          ? Object.values(searchableMap).join(" | ")
          : String(searchableMap[columnFilter] || "");

      return searchableValue.toLowerCase().includes(query);
    });
  }, [columnFilter, search, state.items]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (state.loading) {
    return (
      <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-6 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
        <OpenBookLoader title="Loading parent interview forms" subtitle="Fetching interview form records..." />
      </section>
    );
  }

  if (state.error) {
    return (
      <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {state.error}
      </section>
    );
  }

  return (
    <section className="relative w-full max-w-full min-w-0 space-y-4 overflow-visible">
      <div className="flex w-full max-w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-[16rem] lg:w-[18rem]">
          <select
            value={columnFilter}
            onChange={(event) => setColumnFilter(event.target.value)}
            className="h-12 w-full appearance-none rounded-2xl border border-[#2D8A6A]/15 bg-white px-4 pr-11 text-sm font-semibold text-[#063F32] outline-none shadow-sm transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#FFF5D6]"
          >
            <option value="all">All columns</option>
            <option value="registration_id">Registration ID</option>
            <option value="parent_name">Parent Name</option>
            <option value="parent_email">Parent Email</option>
            <option value="child_name">Child Name</option>
            <option value="child_age">Child Age</option>
            <option value="interested_programme">Interested Programme</option>
            <option value="status">Status</option>
            <option value="submitted_at">Submitted At</option>
            <option value="responses">Answers</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" strokeWidth={2.5} />
        </div>

        <label className="flex min-w-0 flex-[1_1_16rem] items-center gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-white px-4 py-3 shadow-sm">
          <Search className="h-4 w-4 text-[#0D5C48]" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search selected column"
            className="min-w-0 w-full bg-transparent text-sm text-[#063F32] outline-none placeholder:text-[#7A938B]"
          />
        </label>
      </div>

      <div className="w-full max-w-full min-w-0 overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F1EADC]">
            <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)]">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">Parent Name</th>
                <th className="px-6 py-4">Parent Email</th>
                <th className="px-6 py-4">Child Name</th>
                <th className="px-6 py-4">Child Age</th>
                <th className="px-6 py-4">Interested Programme</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Submitted At</th>
                <th className="px-6 py-4">See Answers</th>
                <th className="px-6 py-4">Download PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {paginatedItems.map((item, index) => (
                <tr key={item.id} className="align-top">
                  <td className="px-5 py-5 text-sm font-semibold text-[#0D5C48]">
                    {String((currentPage - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}
                  </td>
                  <td className="px-5 py-5 text-[#063F32]">{textOrDash(item.parent_name)}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.parent_email)}</td>
                  <td className="px-5 py-5 font-semibold text-[#063F32]">{textOrDash(item.child_name)}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.child_age)}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.interested_programme)}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{textOrDash(item.status)}</td>
                  <td className="px-5 py-5 text-[#245C4F]">{formatDate(item.submitted_at || item.created_at)}</td>
                  <td className="px-5 py-5 text-[#245C4F]">
                    <button
                      type="button"
                      onClick={() => setSelectedResponse((current) => (current?.id === item.id ? null : item))}
                      className="max-w-[14rem] truncate rounded-full border border-[#2D8A6A]/20 bg-[#EAF6EF] px-4 py-2 text-left text-xs font-semibold text-[#0D5C48] transition hover:bg-[#DFF2E7]"
                      >
                      See Answers
                    </button>
                  </td>
                  <td className="px-5 py-5 text-[#245C4F]">
                    <button
                      type="button"
                      onClick={() => downloadParentInterviewPdf(item)}
                      disabled={downloadingId === item.id}
                      className="inline-flex items-center gap-2 rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#EAF6EF] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {downloadingId === item.id ? "Downloading..." : "Download PDF"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filteredItems.length ? (
          <div className="px-6 py-10 text-center text-sm text-[#245C4F]">No parent interview forms found.</div>
        ) : null}
        {filteredItems.length > PAGE_SIZE ? (
          <PaginationControls
            page={currentPage}
            pageSize={PAGE_SIZE}
            totalItems={filteredItems.length}
            onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
          />
        ) : null}
      </div>

      {isMounted && selectedResponse
        ? createPortal(
            <div className="absolute inset-0 z-[999] flex items-center justify-center bg-[rgba(13,59,46,0.10)] px-4 py-6 backdrop-blur-sm">
              <section className="w-full max-w-4xl rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.99)_100%)] p-5 shadow-[0_16px_50px_-36px_rgba(13,59,46,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#C9A227]">
                  Full questions/answer detials
                </p>
                <p className="mt-2 text-sm font-semibold text-[#063F32]">
                  {textOrDash(selectedResponse.parent_name)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResponse(null)}
                className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>
            <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-[1.25rem] border border-[#2D8A6A]/10 bg-white p-3">
              <div className="mt-3 space-y-3">
                {responseSummary.pairs.map((item, index) => (
                  <div
                    key={`${item.key}-${index}`}
                    className="rounded-2xl border border-white bg-[#FAF7F0] p-4 shadow-[0_8px_20px_-18px_rgba(13,59,46,0.16)]"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">
                      Question #{item.questionNumber || index + 1}: {item.question}
                    </p>
                    <div className="mt-2 rounded-2xl border border-[#F1EADC] bg-[#FAF7F0] px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
                        Answer:
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#245C4F]">
                        {formatFlatObject(item.answer)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
              </section>
            </div>,
            document.getElementById(portalTargetId) || document.body
          )
        : null}
    </section>
  );
}
