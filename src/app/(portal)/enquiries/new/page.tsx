"use client";
import { cx } from "@/components/utilities";
import { readResponse } from "@/components/ui";
import layout from "./page.module.css";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEnquiryPage() {
  const router = useRouter();
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [requirementsText, setRequirementsText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName,
          contactEmail,
          contactPhone: contactPhone || undefined,
          siteLocation,
          requirementsText: requirementsText || undefined,
        }),
      });

      const data: any = await readResponse(res);
      if (!res.ok) throw new Error(data.error || "Failed to record enquiry");

      router.push(`/enquiries/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={cx(layout.block1)}>
      {/* Breadcrumb */}
      <nav className={cx(layout.block2)}>
        <a href="/enquiries" className={cx(layout.block3)}>
          Enquiries
        </a>
        <span>/</span>
        <span className={cx(layout.block4)}>Record Intake</span>
      </nav>

      <div>
        <h1 className={cx("text-display")}>Record Client Enquiry</h1>
        <p className={cx(["text-muted", layout.block5].join(" "))}>
          Capture prospective client brief, project location, and preliminary
          spatial requirements.
        </p>
      </div>

      {error && <div className={cx(layout.block6)}>{error}</div>}

      <form
        onSubmit={handleSubmit}
        className={cx(["card", layout.block7].join(" "))}
      >
        <div>
          <label className={cx(layout.block8)} htmlFor="contactName">
            Prospect / Client Name *
          </label>
          <input
            type="text"
            required
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="e.g. Rahul Menon"
            className={cx(layout.block9)}
            id="contactName"
          />
        </div>

        <div className={cx(layout.block10)}>
          <div>
            <label className={cx(layout.block11)} htmlFor="contactEmail">
              Email Address *
            </label>
            <input
              type="email"
              required
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="rahul@example.com"
              className={cx(layout.block12)}
              id="contactEmail"
            />
          </div>

          <div>
            <label className={cx(layout.block13)} htmlFor="contactPhone">
              Phone Number
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+91 98470 12345"
              className={cx(layout.block14)}
              id="contactPhone"
            />
          </div>
        </div>

        <div>
          <label className={cx(layout.block15)} htmlFor="siteLocation">
            Site Location *
          </label>
          <input
            type="text"
            required
            value={siteLocation}
            onChange={(e) => setSiteLocation(e.target.value)}
            placeholder="e.g. Aluva, Ernakulam, Kerala"
            className={cx(layout.block16)}
            id="siteLocation"
          />
        </div>

        <div>
          <label className={cx(layout.block17)}>
            Initial Project Brief & Spatial Requirements
          </label>
          <textarea
            rows={4}
            value={requirementsText}
            onChange={(e) => setRequirementsText(e.target.value)}
            placeholder="e.g. 4-bedroom contemporary tropical residence with central courtyard, approximately 4,200 sq.ft..."
            className={cx(layout.block18)}
          />
        </div>

        <div className={cx(layout.block19)}>
          <a href="/enquiries" className={cx("btn-secondary")}>
            Cancel
          </a>
          <button
            type="submit"
            className={cx("btn-primary")}
            disabled={submitting}
          >
            {submitting ? "Recording..." : "Record Enquiry"}
          </button>
        </div>
      </form>
    </div>
  );
}
