"use client";
import React, {
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
  useId,
} from "react";
import styles from "./ui.module.css";
export { styles as ui };
export function PageHeader({
  title,
  description,
  actions,
  section = false,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  section?: boolean;
}) {
  return (
    <header className={styles.header}>
      <div>
        {section ? (
          <h2 className={styles.sectionHeading}>{title}</h2>
        ) : (
          <h1 className={styles.heading}>{title}</h1>
        )}
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions}
    </header>
  );
}
export function Button({
  secondary,
  danger,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      className={[
        styles.button,
        secondary ? styles.secondary : "",
        danger ? styles.danger : "",
        className,
      ].join(" ")}
      {...props}
    />
  );
}
export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  const generatedId = useId();
  const control = React.isValidElement(children)
    ? (children as React.ReactElement<any>)
    : null;
  const id = control?.props.id || generatedId;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {control
        ? React.cloneElement(control, {
            id,
            ...(help ? { "aria-describedby": id + "-help" } : {}),
          })
        : children}
      {help && (
        <small id={id + "-help"} className={styles.help}>
          {help}
        </small>
      )}
    </div>
  );
}
export function Badge({ children }: { children: React.ReactNode }) {
  const text = String(children);
  return (
    <span
      className={[
        styles.badge,
        /RELEASED|ACTIVE|COMPLETED|RECEIVED|RESOLVED|ACCEPTED/.test(text)
          ? styles.positive
          : /REJECTED|DISABLED|OVERDUE|FAILED/.test(text)
            ? styles.negative
            : /PENDING|REVIEW|DUE|BLOCKED/.test(text)
              ? styles.warning
              : "",
      ].join(" ")}
    >
      {text
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())}
    </span>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div role="alert" className={styles.error}>
      <div>
        <strong>Something needs attention</strong>
        <p>{message}</p>
      </div>
      {retry && (
        <Button secondary onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function EmptyState({
  title = "Nothing here yet",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function LoadingState({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={styles.loading}>
      {label}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  open = true,
  side = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  open?: boolean;
  side?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const feedback = useFeedback();
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    return () => {
      dialog?.close();
      feedback.dismissNotice();
      requestAnimationFrame(() => {
        if (prior?.isConnected) prior.focus();
      });
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={[styles.dialog, side ? styles.sideDialog : ""].join(" ")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <header className={styles.dialogHeader}>
        <h2>{title}</h2>
        <Button secondary aria-label="Close dialog" onClick={onClose}>
          Close
        </Button>
      </header>
      <div className={styles.dialogBody}>
        {feedback.notice && (
          <div role="alert" className={styles.error}>
            <p>{feedback.notice}</p>
            <Button secondary type="button" onClick={feedback.dismissNotice}>
              Dismiss
            </Button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
interface Question {
  message: string;
  input?: boolean;
  resolve: (v: any) => void;
}
const FeedbackContext = createContext({
  confirm: async (_message: string): Promise<boolean> => false,
  prompt: async (_message: string): Promise<string | null> => null,
  notify: (_message: string) => {},
  notice: "",
  dismissNotice: () => {},
});
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");
  function complete(v: any) {
    question?.resolve(v);
    setQuestion(null);
    setAnswer("");
  }
  return (
    <FeedbackContext.Provider
      value={{
        confirm: (message) =>
          new Promise((resolve) => setQuestion({ message, resolve })),
        prompt: (message) =>
          new Promise((resolve) =>
            setQuestion({ message, resolve, input: true }),
          ),
        notify: setNotice,
        notice,
        dismissNotice: () => setNotice(""),
      }}
    >
      {notice && (
        <div role="status" className={styles.error}>
          <p>{notice}</p>
          <Button secondary onClick={() => setNotice("")}>
            Dismiss
          </Button>
        </div>
      )}
      {children}
      {question && (
        <Dialog
          title={question.input ? "Add completion notes" : "Confirm action"}
          onClose={() => complete(question.input ? null : false)}
        >
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              complete(question.input ? answer : true);
            }}
          >
            <p>{question.message}</p>
            {question.input && (
              <Field label="Notes">
                <textarea
                  autoFocus
                  required
                  rows={4}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
              </Field>
            )}
            <div className={styles.actions}>
              <Button type="submit">
                {question.input ? "Save notes" : "Confirm"}
              </Button>
              <Button
                secondary
                type="button"
                onClick={() => complete(question.input ? null : false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </FeedbackContext.Provider>
  );
}
export function useFeedback() {
  return useContext(FeedbackContext);
}
export async function readResponse(res: Response): Promise<any> {
  const type = res.headers.get("content-type") || "";
  if (!type.includes("application/json"))
    throw new Error(
      res.status === 401
        ? "Your session has expired. Sign in again to continue."
        : "The server could not complete this request. Try again.",
    );
  const body: any = await res.json();
  if (!res.ok)
    throw new Error(
      body.error ||
        (res.status === 403
          ? "You do not have access to this action."
          : "Unable to save. Please try again."),
    );
  if (typeof window !== "undefined" && !/\/api\/(celebrations|preferences\/appearance)/.test(res.url)) window.dispatchEvent(new Event("merveille:refresh-celebrations"));
  return body;
}
export function FilePreview({
  fileId,
  name,
  mimeType,
}: {
  fileId: string;
  name: string;
  mimeType?: string;
}) {
  const [zoom, setZoom] = useState(100);
  const [failed, setFailed] = useState(false);
  const url = `/api/files/${encodeURIComponent(fileId)}/download`;
  const isImage =
    mimeType?.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name);
  const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(name);
  return (
    <div className={styles.preview}>
      <div className={styles.previewToolbar}>
        <strong>{name}</strong>
        <a href={url} className="btn-secondary">
          Download
        </a>
      </div>
      {failed ? (
        <div className={styles.previewFallback}>
          Preview could not load. Try downloading the file.
        </div>
      ) : isImage ? (
        <>
          <div className={styles.actions}>
            <Button
              secondary
              onClick={() => setZoom(Math.max(50, zoom - 25))}
              aria-label="Zoom out"
            >
              −
            </Button>
            <span>{zoom}%</span>
            <Button
              secondary
              onClick={() => setZoom(Math.min(200, zoom + 25))}
              aria-label="Zoom in"
            >
              +
            </Button>
          </div>
          <div className="preview-image-scroll">
            <img
              src={`${url}?preview=true`}
              alt={name}
              onError={() => setFailed(true)}
              style={{ width: `${zoom}%` }}
            />
          </div>
        </>
      ) : isPdf ? (
        <iframe
          title={`Preview ${name}`}
          src={`${url}?preview=true#toolbar=1&navpanes=0`}
          onError={() => setFailed(true)}
        />
      ) : mimeType?.startsWith("video/") ? (
        <video
          controls
          src={`${url}?preview=true`}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={styles.previewFallback}>
          <strong>Download to view this file</strong>
          <p>A browser preview is unavailable for this format.</p>
        </div>
      )}
    </div>
  );
}
