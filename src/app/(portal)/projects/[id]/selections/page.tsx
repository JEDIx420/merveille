"use client";
import { PermissionGate } from "@/components/permission-gate";
import { ProjectMutation } from "@/components/project-mutation";
import { cx } from "@/components/utilities";
import { Dialog, readResponse } from "@/components/ui";
import { useFeedback } from "@/components/ui";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface ClientReference {
  id: string;
  project_id: string;
  uploader_name: string;
  file_name?: string;
  external_url?: string;
  caption: string;
  room_area?: string;
  category?: string;
  created_at: number;
}

interface SelectionOption {
  id: string;
  selection_item_id: string;
  option_label: string;
  description?: string;
  file_name?: string;
  external_link?: string;
  cost_implication_minor: number;
  schedule_implication_days: number;
  is_recommended: number;
}

interface SelectionItem {
  id: string;
  title: string;
  location?: string;
  question: string;
  needed_by_date?: string;
  status: string;
  selected_option_id?: string;
  selected_by_user_id?: string;
  selector_name?: string;
  change_request_id?: string;
  internal_notes?: string;
  manager_name?: string;
  created_at: number;
  options?: SelectionOption[];
}

export default function SelectionsPage() {
  const feedback = useFeedback();
  const params = useParams();
  const projectId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [references, setReferences] = useState<ClientReference[]>([]);
  const [selectionItems, setSelectionItems] = useState<SelectionItem[]>([]);
  const [activeTab, setActiveTab] = useState<"SELECTIONS" | "REFERENCES">(
    "SELECTIONS",
  );

  // Modals
  const [showAddRefModal, setShowAddRefModal] = useState(false);
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<SelectionItem | null>(null);

  // Form states
  const [refCaption, setRefCaption] = useState("");
  const [refRoomArea, setRefRoomArea] = useState("");
  const [refExternalUrl, setRefExternalUrl] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemLocation, setItemLocation] = useState("");
  const [itemQuestion, setItemQuestion] = useState("");
  const [itemNeededDate, setItemNeededDate] = useState("");
  const [itemInternalNotes, setItemInternalNotes] = useState("");
  const [opt1Label, setOpt1Label] = useState("");
  const [opt1Desc, setOpt1Desc] = useState("");
  const [opt1Cost, setOpt1Cost] = useState("0");
  const [opt2Label, setOpt2Label] = useState("");
  const [opt2Desc, setOpt2Desc] = useState("");
  const [opt2Cost, setOpt2Cost] = useState("0");

  const [suggestText, setSuggestText] = useState("");
  const [suggestOptionId, setSuggestOptionId] = useState("");
  const [selectOptionId, setSelectOptionId] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/materials`);
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to load materials and selections");
      }
      const data = (await readResponse(res)) as any;
      setReferences(data.references || []);
      setSelectionItems(data.selectionItems || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) loadData();
  }, [projectId]);

  const handleAddReference = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/projects/${projectId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_reference",
          caption: refCaption,
          roomArea: refRoomArea,
          externalUrl: refExternalUrl || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to add reference");
      }
      setShowAddRefModal(false);
      setRefCaption("");
      setRefRoomArea("");
      setRefExternalUrl("");
      await loadData();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleCreateSelectionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const options = [
        {
          label: opt1Label,
          description: opt1Desc,
          costImplicationMinor: Math.round(parseFloat(opt1Cost || "0") * 100),
          isRecommended: true,
        },
      ];
      if (opt2Label.trim()) {
        options.push({
          label: opt2Label,
          description: opt2Desc,
          costImplicationMinor: Math.round(parseFloat(opt2Cost || "0") * 100),
          isRecommended: false,
        });
      }

      const res = await fetch(`/api/projects/${projectId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_selection",
          title: itemTitle,
          location: itemLocation,
          question: itemQuestion,
          neededByDate: itemNeededDate || undefined,
          internalNotes: itemInternalNotes || undefined,
          options,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to create selection item");
      }
      setShowCreateItemModal(false);
      setItemTitle("");
      setItemLocation("");
      setItemQuestion("");
      setItemNeededDate("");
      setItemInternalNotes("");
      setOpt1Label("");
      setOpt1Desc("");
      setOpt1Cost("0");
      setOpt2Label("");
      setOpt2Desc("");
      setOpt2Cost("0");
      await loadData();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleRecordSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItemId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_suggestion",
          selectionItemId: activeItemId,
          optionId: suggestOptionId || undefined,
          suggestionType: "SUGGESTION",
          commentText: suggestText,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to record suggestion");
      }
      setShowSuggestModal(false);
      setSuggestText("");
      await loadData();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleSelectOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItemId || !selectOptionId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "select_option",
          selectionItemId: activeItemId,
          optionId: selectOptionId,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to select option");
      }
      setShowSelectModal(false);
      await loadData();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const handleMarkReady = async (itemId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_ready",
          selectionItemId: itemId,
        }),
      });
      if (!res.ok) {
        const err = (await readResponse(res)) as any;
        throw new Error(err.error || "Failed to mark ready for execution");
      }
      await loadData();
    } catch (e: any) {
      feedback.notify(e.message);
    }
  };

  const formatCurrency = (minor: number) => {
    return `₹${(minor / 100).toLocaleString("en-IN")}`;
  };

  return (
    <div className={cx("max-w-7xl mx-auto px-4 sm:px-6 py-8")}>
      {/* Header */}
      <div
        className={cx(
          "flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-stone-200 mb-8",
        )}
      >
        <div>
          <span
            className={cx(
              "text-xs uppercase tracking-widest text-stone-500 font-sans",
            )}
          >
            Client Collaboration
          </span>
          <h1 className={cx("text-3xl font-serif text-stone-900 mt-1")}>
            Materials, Selections & References
          </h1>
          <p className={cx("text-sm text-stone-600 mt-1")}>
            Authoritative material decisions bind scope. Inspiration references
            and suggestions guide design without unapproved cost.
          </p>
        </div>
        <div className={cx("flex gap-3 mt-4 md:mt-0")}>
          <ProjectMutation>
            <button
              onClick={() => setShowAddRefModal(true)}
              className={cx(
                "px-4 py-2 border border-stone-300 text-stone-800 text-sm font-sans hover:bg-stone-50 transition",
              )}
            >
              + Add Reference
            </button>
          </ProjectMutation>
          <ProjectMutation>
            <button
              onClick={() => setShowCreateItemModal(true)}
              className={cx(
                "px-4 py-2 bg-stone-900 text-stone-100 text-sm font-sans hover:bg-stone-800 transition",
              )}
            >
              + Request Selection
            </button>
          </ProjectMutation>
        </div>
      </div>

      {/* Tabs */}
      <div className={cx("flex border-b border-stone-200 mb-8 gap-8")}>
        <button
          onClick={() => setActiveTab("SELECTIONS")}
          className={cx(
            `pb-3 text-sm font-sans tracking-wide uppercase transition ${
              activeTab === "SELECTIONS"
                ? "border-b-2 border-stone-900 text-stone-900 font-medium"
                : "text-stone-500 hover:text-stone-700"
            }`,
          )}
        >
          Material Selections ({selectionItems.length})
        </button>
        <button
          onClick={() => setActiveTab("REFERENCES")}
          className={cx(
            `pb-3 text-sm font-sans tracking-wide uppercase transition ${
              activeTab === "REFERENCES"
                ? "border-b-2 border-stone-900 text-stone-900 font-medium"
                : "text-stone-500 hover:text-stone-700"
            }`,
          )}
        >
          Reference Library ({references.length})
        </button>
      </div>

      {error && (
        <div
          className={cx(
            "p-4 mb-6 bg-red-50 border border-red-200 text-red-800 text-sm rounded",
          )}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          className={cx("py-12 text-center text-stone-400 font-sans text-sm")}
        >
          Loading selections and reference library...
        </div>
      ) : activeTab === "SELECTIONS" ? (
        /* Selections Section */
        <div className={cx("space-y-6")}>
          {selectionItems.length === 0 ? (
            <div
              className={cx(
                "p-12 text-center border border-dashed border-stone-300 text-stone-500",
              )}
            >
              No material selection decisions currently requested for this
              project.
            </div>
          ) : (
            selectionItems.map((item) => (
              <div
                key={item.id}
                className={cx(
                  "bg-white border border-stone-200 p-6 shadow-sm hover:border-stone-300 transition",
                )}
              >
                <div
                  className={cx(
                    "flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-4 border-b border-stone-100",
                  )}
                >
                  <div>
                    <div className={cx("flex items-center gap-3")}>
                      <span
                        className={cx(
                          "text-xs uppercase font-sans tracking-wider px-2 py-0.5 bg-stone-100 text-stone-700",
                        )}
                      >
                        {item.location || "General Space"}
                      </span>
                      <span
                        className={cx(
                          `text-xs uppercase font-sans tracking-wider px-2 py-0.5 font-medium ${
                            item.status === "SELECTED"
                              ? "bg-emerald-50 text-emerald-800"
                              : item.status === "READY_FOR_EXECUTION"
                                ? "bg-blue-50 text-blue-800"
                                : item.status === "CHANGES_REQUESTED"
                                  ? "bg-amber-50 text-amber-800"
                                  : "bg-stone-100 text-stone-700"
                          }`,
                        )}
                      >
                        {item.status.replace(/_/g, " ")}
                      </span>
                      {item.needed_by_date && (
                        <span
                          className={cx("text-xs text-stone-500 font-sans")}
                        >
                          Needed by: {item.needed_by_date}
                        </span>
                      )}
                    </div>
                    <h3
                      className={cx(
                        "text-lg font-serif text-stone-900 mt-2 font-medium",
                      )}
                    >
                      {item.title}
                    </h3>
                    <p className={cx("text-sm text-stone-600 mt-1 font-sans")}>
                      {item.question}
                    </p>
                    {item.internal_notes && (
                      <div
                        className={cx(
                          "mt-2 p-2 bg-stone-50 border-l-2 border-amber-600 text-xs text-stone-600",
                        )}
                      >
                        <span className={cx("font-semibold text-stone-800")}>
                          Practice Confidential:{" "}
                        </span>
                        {item.internal_notes}
                      </div>
                    )}
                  </div>

                  <div className={cx("flex flex-wrap gap-2")}>
                    {item.status === "AWAITING_MAIN_CLIENT" && (
                      <>
                        <ProjectMutation>
                          <button
                            onClick={() => {
                              setActiveItemId(item.id);
                              setActiveItem(item);
                              setShowSuggestModal(true);
                            }}
                            className={cx(
                              "px-3 py-1.5 text-xs font-sans border border-stone-300 hover:bg-stone-50 text-stone-700",
                            )}
                          >
                            Suggest Preference (Rep/Staff)
                          </button>
                        </ProjectMutation>
                        <ProjectMutation>
                          <PermissionGate projectId={projectId} contractual>
                            <button
                              onClick={() => {
                                setActiveItemId(item.id);
                                setActiveItem(item);
                                setShowSelectModal(true);
                              }}
                              className={cx(
                                "px-3 py-1.5 text-xs font-sans bg-stone-900 hover:bg-stone-800 text-white",
                              )}
                            >
                              Select Option (Main Client)
                            </button>
                          </PermissionGate>
                        </ProjectMutation>
                      </>
                    )}

                    {item.status === "SELECTED" && (
                      <ProjectMutation>
                        <PermissionGate
                          projectId={projectId}
                          roles={["MANAGER"]}
                        >
                          <button
                            onClick={() => handleMarkReady(item.id)}
                            className={cx(
                              "px-3 py-1.5 text-xs font-sans bg-emerald-800 hover:bg-emerald-700 text-white",
                            )}
                          >
                            Mark Ready for Execution
                          </button>
                        </PermissionGate>
                      </ProjectMutation>
                    )}
                  </div>
                </div>

                {/* Options List */}
                <div
                  className={cx("mt-4 grid grid-cols-1 md:grid-cols-2 gap-4")}
                >
                  {item.options?.map((opt) => {
                    const isSelected = item.selected_option_id === opt.id;
                    const hasCost = opt.cost_implication_minor > 0;
                    return (
                      <div
                        key={opt.id}
                        className={cx(
                          `p-4 border ${
                            isSelected
                              ? "border-emerald-700 bg-emerald-50/20"
                              : "border-stone-200 bg-stone-50/50"
                          } flex flex-col justify-between`,
                        )}
                      >
                        <div>
                          <div
                            className={cx("flex items-center justify-between")}
                          >
                            <span
                              className={cx(
                                "text-sm font-medium text-stone-900",
                              )}
                            >
                              {opt.option_label}
                            </span>
                            {isSelected && (
                              <span
                                className={cx(
                                  "text-xs uppercase bg-emerald-800 text-white px-2 py-0.5 tracking-wider font-sans",
                                )}
                              >
                                Chosen
                              </span>
                            )}
                          </div>
                          {opt.description && (
                            <p
                              className={cx(
                                "text-xs text-stone-600 mt-2 font-sans",
                              )}
                            >
                              {opt.description}
                            </p>
                          )}
                        </div>

                        <div
                          className={cx(
                            "mt-4 pt-3 border-t border-stone-200 flex items-center justify-between text-xs font-sans",
                          )}
                        >
                          <span
                            className={cx(
                              hasCost
                                ? "text-amber-800 font-medium"
                                : "text-stone-500",
                            )}
                          >
                            {hasCost
                              ? `+ ${formatCurrency(opt.cost_implication_minor)} (Requires Change Approval)`
                              : "Included in Scope"}
                          </span>
                          {opt.schedule_implication_days > 0 && (
                            <span className={cx("text-stone-500")}>
                              +{opt.schedule_implication_days} days
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Reference Library Section */
        <div
          className={cx("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6")}
        >
          {references.length === 0 ? (
            <div
              className={cx(
                "col-span-full p-12 text-center border border-dashed border-stone-300 text-stone-500",
              )}
            >
              No client references or inspiration items uploaded yet.
            </div>
          ) : (
            references.map((ref) => (
              <div
                key={ref.id}
                className={cx(
                  "bg-white border border-stone-200 overflow-hidden shadow-sm hover:border-stone-300 transition flex flex-col justify-between",
                )}
              >
                <div className={cx("p-4")}>
                  <div
                    className={cx(
                      "flex items-center justify-between text-xs text-stone-500 font-sans mb-2",
                    )}
                  >
                    <span>{ref.room_area || "General Space"}</span>
                    <span>{new Date(ref.created_at).toLocaleDateString()}</span>
                  </div>
                  <h4
                    className={cx(
                      "text-sm font-serif font-medium text-stone-900",
                    )}
                  >
                    {ref.caption}
                  </h4>
                  {ref.external_url && (
                    <a
                      href={ref.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cx(
                        "text-xs text-blue-700 hover:underline mt-2 inline-block font-sans break-all",
                      )}
                    >
                      External Reference Link ↗
                    </a>
                  )}
                </div>

                <div
                  className={cx(
                    "px-4 py-2 bg-stone-50 border-t border-stone-100 text-xs text-stone-500 font-sans flex justify-between items-center",
                  )}
                >
                  <span>Uploaded by {ref.uploader_name}</span>
                  {ref.file_name && (
                    <span className={cx("font-mono text-stone-400")}>
                      {ref.file_name}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Reference Modal */}
      {showAddRefModal && (
        <Dialog
          title="Add Inspiration Reference"
          onClose={() => setShowAddRefModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-md w-full p-6 shadow-xl border border-stone-200",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-4")}>
              Add Inspiration Reference
            </h3>
            <form onSubmit={handleAddReference} className={cx("space-y-4")}>
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="refCaption"
                >
                  Caption / Description *
                </label>
                <input
                  type="text"
                  required
                  value={refCaption}
                  onChange={(e) => setRefCaption(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm focus:outline-none focus:border-stone-900",
                  )}
                  placeholder="e.g. Scandi Fluted Oak Feature Wall"
                  id="refCaption"
                />
              </div>

              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="refRoomArea"
                >
                  Room / Area
                </label>
                <input
                  type="text"
                  value={refRoomArea}
                  onChange={(e) => setRefRoomArea(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm focus:outline-none focus:border-stone-900",
                  )}
                  placeholder="e.g. Living Room, Dining, Master Suite"
                  id="refRoomArea"
                />
              </div>

              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="refExternalUrl"
                >
                  External Reference Link (Optional)
                </label>
                <input
                  type="url"
                  value={refExternalUrl}
                  onChange={(e) => setRefExternalUrl(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm focus:outline-none focus:border-stone-900",
                  )}
                  placeholder="https://..."
                  id="refExternalUrl"
                />
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowAddRefModal(false)}
                  className={cx(
                    "px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cx(
                    "px-4 py-2 bg-stone-900 text-white text-sm font-sans hover:bg-stone-800",
                  )}
                >
                  Save Reference
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Request Selection Modal (Staff framed) */}
      {showCreateItemModal && (
        <Dialog
          title="Frame Material Selection Decision"
          onClose={() => setShowCreateItemModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-lg w-full p-6 shadow-xl border border-stone-200 max-h-[90vh] overflow-y-auto",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-4")}>
              Frame Material Selection Decision
            </h3>
            <form
              onSubmit={handleCreateSelectionItem}
              className={cx("space-y-4")}
            >
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="itemTitle"
                >
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="e.g. Master Bedroom Headboard Finish"
                  id="itemTitle"
                />
              </div>

              <div className={cx("grid grid-cols-2 gap-3")}>
                <div>
                  <label
                    className={cx(
                      "block text-xs font-sans uppercase text-stone-600 mb-1",
                    )}
                    htmlFor="itemLocation"
                  >
                    Location
                  </label>
                  <input
                    type="text"
                    value={itemLocation}
                    onChange={(e) => setItemLocation(e.target.value)}
                    className={cx(
                      "w-full px-3 py-2 border border-stone-300 text-sm",
                    )}
                    placeholder="e.g. Master Bedroom"
                    id="itemLocation"
                  />
                </div>
                <div>
                  <label
                    className={cx(
                      "block text-xs font-sans uppercase text-stone-600 mb-1",
                    )}
                    htmlFor="itemNeededDate"
                  >
                    Needed by Date
                  </label>
                  <input
                    type="date"
                    value={itemNeededDate}
                    onChange={(e) => setItemNeededDate(e.target.value)}
                    className={cx(
                      "w-full px-3 py-2 border border-stone-300 text-sm",
                    )}
                    id="itemNeededDate"
                  />
                </div>
              </div>

              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                >
                  Question for Client *
                </label>
                <textarea
                  required
                  rows={2}
                  value={itemQuestion}
                  onChange={(e) => setItemQuestion(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="e.g. Please choose between upholstered fabric vs solid fluted wood finish."
                />
              </div>

              <div className={cx("p-3 bg-stone-50 border border-stone-200")}>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="itemInternalNotes"
                >
                  Internal Practice Notes (Hidden from Client)
                </label>
                <input
                  type="text"
                  value={itemInternalNotes}
                  onChange={(e) => setItemInternalNotes(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm bg-white",
                  )}
                  placeholder="Supplier pricing, margin discussions, lead times..."
                  id="itemInternalNotes"
                />
              </div>

              <div className={cx("pt-2 border-t border-stone-200")}>
                <h4
                  className={cx(
                    "text-xs font-sans uppercase text-stone-800 font-semibold mb-2",
                  )}
                >
                  Option 1 (Baseline / Standard)
                </h4>
                <div className={cx("space-y-2")}>
                  <input
                    type="text"
                    required
                    value={opt1Label}
                    onChange={(e) => setOpt1Label(e.target.value)}
                    className={cx(
                      "w-full px-3 py-1.5 border border-stone-300 text-sm",
                    )}
                    placeholder="Option Label (e.g. Acoustic Suede Fabric)"
                  />
                  <input
                    type="text"
                    value={opt1Desc}
                    onChange={(e) => setOpt1Desc(e.target.value)}
                    className={cx(
                      "w-full px-3 py-1.5 border border-stone-300 text-sm",
                    )}
                    placeholder="Description"
                  />
                  <div className={cx("flex items-center gap-2")}>
                    <span className={cx("text-xs font-sans text-stone-500")}>
                      Extra Cost (₹):
                    </span>
                    <input
                      type="number"
                      value={opt1Cost}
                      onChange={(e) => setOpt1Cost(e.target.value)}
                      className={cx(
                        "w-28 px-2 py-1 border border-stone-300 text-sm",
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className={cx("pt-2 border-t border-stone-200")}>
                <h4
                  className={cx(
                    "text-xs font-sans uppercase text-stone-800 font-semibold mb-2",
                  )}
                >
                  Option 2 (Alternative / Upgrade)
                </h4>
                <div className={cx("space-y-2")}>
                  <input
                    type="text"
                    value={opt2Label}
                    onChange={(e) => setOpt2Label(e.target.value)}
                    className={cx(
                      "w-full px-3 py-1.5 border border-stone-300 text-sm",
                    )}
                    placeholder="Option Label (e.g. Fluted Charcoal Wood)"
                  />
                  <input
                    type="text"
                    value={opt2Desc}
                    onChange={(e) => setOpt2Desc(e.target.value)}
                    className={cx(
                      "w-full px-3 py-1.5 border border-stone-300 text-sm",
                    )}
                    placeholder="Description"
                  />
                  <div className={cx("flex items-center gap-2")}>
                    <span className={cx("text-xs font-sans text-stone-500")}>
                      Extra Cost (₹):
                    </span>
                    <input
                      type="number"
                      value={opt2Cost}
                      onChange={(e) => setOpt2Cost(e.target.value)}
                      className={cx(
                        "w-28 px-2 py-1 border border-stone-300 text-sm",
                      )}
                    />
                  </div>
                </div>
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowCreateItemModal(false)}
                  className={cx(
                    "px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cx(
                    "px-4 py-2 bg-stone-900 text-white text-sm font-sans hover:bg-stone-800",
                  )}
                >
                  Publish Decision Request
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Suggest Preference Modal (Representative / Staff) */}
      {showSuggestModal && activeItem && (
        <Dialog
          title="Suggest Non-Binding Preference"
          onClose={() => setShowSuggestModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-md w-full p-6 shadow-xl border border-stone-200",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-1")}>
              Suggest Non-Binding Preference
            </h3>
            <p className={cx("text-xs text-stone-500 font-sans mb-4")}>
              Representatives and consultants can provide input. The main client
              retains exclusive binding decision authority.
            </p>
            <form onSubmit={handleRecordSuggestion} className={cx("space-y-4")}>
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                  htmlFor="suggestOptionId"
                >
                  Preferred Option
                </label>
                <select
                  value={suggestOptionId}
                  onChange={(e) => setSuggestOptionId(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  id="suggestOptionId"
                >
                  <option value="">No specific option selected</option>
                  {activeItem.options?.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.option_label}{" "}
                      {opt.cost_implication_minor > 0
                        ? `(+ ${formatCurrency(opt.cost_implication_minor)})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                >
                  Suggestion Note / Reasoning *
                </label>
                <textarea
                  required
                  rows={3}
                  value={suggestText}
                  onChange={(e) => setSuggestText(e.target.value)}
                  className={cx(
                    "w-full px-3 py-2 border border-stone-300 text-sm",
                  )}
                  placeholder="e.g. Representative preference: we feel the charcoal finish adds more depth..."
                />
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowSuggestModal(false)}
                  className={cx(
                    "px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cx(
                    "px-4 py-2 bg-stone-900 text-white text-sm font-sans hover:bg-stone-800",
                  )}
                >
                  Record Suggestion
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {/* Select Option Modal (Main Client Binding Decision) */}
      {showSelectModal && activeItem && (
        <Dialog
          title="Authoritative Material Decision"
          onClose={() => setShowSelectModal(false)}
        >
          <div
            className={cx(
              "bg-white max-w-md w-full p-6 shadow-xl border border-stone-200",
            )}
          >
            <h3 className={cx("text-lg font-serif text-stone-900 mb-1")}>
              Authoritative Material Decision
            </h3>
            <p className={cx("text-xs text-stone-500 font-sans mb-4")}>
              Main Client binding selection for:{" "}
              <strong className={cx("text-stone-800")}>
                {activeItem.title}
              </strong>
            </p>
            <form onSubmit={handleSelectOption} className={cx("space-y-4")}>
              <div>
                <label
                  className={cx(
                    "block text-xs font-sans uppercase text-stone-600 mb-1",
                  )}
                >
                  Select Option *
                </label>
                <div className={cx("space-y-2")}>
                  {activeItem.options?.map((opt) => (
                    <label
                      key={opt.id}
                      className={cx(
                        "flex items-start gap-3 p-3 border border-stone-200 rounded cursor-pointer hover:bg-stone-50",
                      )}
                    >
                      <input
                        type="radio"
                        name="select_opt"
                        required
                        value={opt.id}
                        checked={selectOptionId === opt.id}
                        onChange={() => setSelectOptionId(opt.id)}
                        className={cx("mt-1")}
                      />
                      <div>
                        <div
                          className={cx("text-sm font-medium text-stone-900")}
                        >
                          {opt.option_label}
                        </div>
                        {opt.cost_implication_minor > 0 ? (
                          <div
                            className={cx(
                              "text-xs text-amber-800 font-medium mt-0.5",
                            )}
                          >
                            + {formatCurrency(opt.cost_implication_minor)}{" "}
                            (Requires Change Estimate)
                          </div>
                        ) : (
                          <div
                            className={cx(
                              "text-xs text-emerald-800 font-medium mt-0.5",
                            )}
                          >
                            Included in Scope
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div
                className={cx(
                  "flex justify-end gap-3 pt-4 border-t border-stone-200",
                )}
              >
                <button
                  type="button"
                  onClick={() => setShowSelectModal(false)}
                  className={cx(
                    "px-4 py-2 border border-stone-300 text-stone-700 text-sm font-sans hover:bg-stone-50",
                  )}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={cx(
                    "px-4 py-2 bg-emerald-800 text-white text-sm font-sans hover:bg-emerald-700",
                  )}
                >
                  Confirm Binding Choice
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}
    </div>
  );
}
