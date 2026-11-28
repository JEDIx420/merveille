"use client";
import { useState } from "react";
import {
  DragDropProvider,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/react";
import { motion, useReducedMotion } from "motion/react";
import { GripVertical } from "lucide-react";
import { useAppearance } from "@/components/experience/provider";
import { Avatar } from "./studio-controls";
import { formatBusinessDate } from "@/shared/config";
import styles from "./workspace.module.css";
export function StudioBoard({
  items,
  columns,
  readOnly,
  canMove,
  move,
  open,
}: {
  items: any[];
  columns: string[][];
  readOnly: boolean;
  canMove: (t: any, s: string) => boolean;
  move: (t: any, s: string) => void;
  open: (t: any) => void;
}) {
  const [drag, setDrag] = useState<any>(null);
  const osReduce = useReducedMotion();
  const { appearance } = useAppearance();
  const reduce = osReduce || appearance.celebrations !== "full";
  return (
    <DragDropProvider
      onDragStart={(e) =>
        setDrag(items.find((t) => t.id === e.operation.source?.id))
      }
      onDragEnd={(e) => {
        const source = items.find((t) => t.id === e.operation.source?.id),
          target = String(e.operation.target?.id || "");
        if (!e.canceled && source && target && canMove(source, target))
          move(source, target);
        setDrag(null);
      }}
    >
      <div className={styles.board}>
        {columns.map(([key, label]) => (
          <Column
            key={key}
            id={key}
            label={label}
            disabled={!drag || !canMove(drag, key)}
          >
            {items
              .filter((t) => t.status === key)
              .map((t) => (
                <Card
                  key={t.id}
                  task={t}
                  columns={columns}
                  disabled={
                    readOnly ||
                    !columns.some(([s]) => s !== t.status && canMove(t, s))
                  }
                  canMove={canMove}
                  move={move}
                  open={open}
                />
              ))}
            {!items.some((t) => t.status === key) && (
              <p className={styles.columnEmpty}>No tasks here</p>
            )}
          </Column>
        ))}
      </div>
      <DragOverlay
        dropAnimation={
          reduce ? null : { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }
        }
      >
        {drag && <div className={styles.dragPreview}>{drag.title}</div>}
      </DragOverlay>
    </DragDropProvider>
  );
}
function Column({
  id,
  label,
  disabled,
  children,
}: {
  id: string;
  label: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { ref, isDropTarget } = useDroppable({ id, disabled });
  return (
    <section
      ref={ref}
      className={styles.column}
      data-status={id}
      data-drop={isDropTarget}
      aria-label={label}
    >
      <h3>
        <span className={styles.statusDot} />
        {label}
      </h3>
      {children}
    </section>
  );
}
function Card({ task: t, columns, disabled, canMove, move, open }: any) {
  const { ref, handleRef, isDragging } = useDraggable({ id: t.id, disabled });
  const osReduce = useReducedMotion();
  const { appearance } = useAppearance();
  const reduce = osReduce || appearance.celebrations !== "full";
  return (
    <motion.article
      layout={!reduce}
      transition={{ layout: { duration: 0.22 } }}
      ref={ref}
      className={styles.card}
      data-dragging={isDragging}
    >
      <div className={styles.cardHeading}>
        <button className={styles.taskTitle} onClick={() => open(t)}>
          {t.title}
        </button>
        <button
          hidden={disabled}
          disabled={disabled}
          ref={handleRef}
          className={styles.dragHandle}
          aria-label={`Drag ${t.title}`}
        >
          <GripVertical size={16} />
        </button>
      </div>
      {t.projectName && (
        <small className={styles.projectChip}>{t.projectName}</small>
      )}
      <div className={styles.cardMeta}>
        <span className={styles.muted}>
          {t.dueDate ? formatBusinessDate(t.dueDate) : "No due date"}
        </span>
        <span title={t.assigneeName || "Unassigned"}>
          <Avatar name={t.assigneeName || "Unassigned"} />
        </span>
      </div>
      {!disabled && (
        <select
          aria-label={`Move ${t.title}`}
          value={t.status}
          onChange={(e) => move(t, e.target.value)}
        >
          {columns
            .filter(([s]: string[]) => s === t.status || canMove(t, s))
            .map(([v, l]: string[]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
        </select>
      )}
    </motion.article>
  );
}
