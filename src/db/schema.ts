import {
  pgTable,
  serial,
  bigserial,
  integer,
  bigint,
  text,
  boolean,
  timestamp,
  jsonb,
  numeric,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const DEPARTMENTS = ["sales", "project", "accounts", "dispatch"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const ROLES = ["admin", "manager", "member"] as const;
export type Role = (typeof ROLES)[number];

export const TASK_STATUSES = ["open", "acknowledged", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "changes_requested"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export type Attachment = { url: string; type: "image" | "video" | "file"; name: string; size: number };
export type CostLine = { item: string; cost: number; qty?: number; note?: string };

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<Role>().notNull().default("member"),
  cityId: integer("city_id").references(() => cities.id, { onDelete: "set null" }),
  department: text("department").$type<Department>(),
  canApprove: boolean("can_approve").notNull().default(false),
  active: boolean("active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  // Set when an admin creates the account or resets the password; the person picks their own on first sign-in.
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// type: one of DEPARTMENTS for city sub-groups, "general" for company-wide, "dm" for direct messages
export const channels = pgTable(
  "channels",
  {
    id: serial("id").primaryKey(),
    cityId: integer("city_id").references(() => cities.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    dmKey: text("dm_key").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("channels_city_type_idx").on(t.cityId, t.type)],
);

export const channelMembers = pgTable(
  "channel_members",
  {
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadMessageId: bigint("last_read_message_id", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.userId] }), index("channel_members_user_idx").on(t.userId)],
);

// kind: text | task | approval | system
export const messages = pgTable(
  "messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull().default("text"),
    body: text("body").notNull().default(""),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    replyToId: bigint("reply_to_id", { mode: "number" }),
    taskId: integer("task_id"),
    approvalId: integer("approval_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_channel_idx").on(t.channelId, t.id)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    assigneeId: integer("assignee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdById: integer("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").$type<TaskStatus>().notNull().default("open"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    // Reminder cadence: until acknowledged, then until completed
    ackReminderMinutes: integer("ack_reminder_minutes").notNull().default(30),
    progressReminderMinutes: integer("progress_reminder_minutes").notNull().default(240),
    lastRemindedAt: timestamp("last_reminded_at", { withTimezone: true }),
    reminderCount: integer("reminder_count").notNull().default(0),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tasks_assignee_idx").on(t.assigneeId, t.status)],
);

export const approvals = pgTable(
  "approvals",
  {
    id: serial("id").primaryKey(),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("app"), // "crm" | "app"
    externalRef: text("external_ref"), // PONGS CRM quotation id
    title: text("title").notNull(),
    customerName: text("customer_name"),
    amount: numeric("amount", { precision: 14, scale: 2 }),
    cost: numeric("cost", { precision: 14, scale: 2 }),
    currency: text("currency").notNull().default("INR"),
    marginPercent: numeric("margin_percent", { precision: 6, scale: 2 }),
    costBreakdown: jsonb("cost_breakdown").$type<CostLine[]>().notNull().default([]),
    notes: text("notes").notNull().default(""),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    crmUrl: text("crm_url"),
    callbackUrl: text("callback_url"),
    requestedById: integer("requested_by_id").references(() => users.id, { onDelete: "set null" }),
    requestedByName: text("requested_by_name"),
    requestedByEmail: text("requested_by_email"),
    approverId: integer("approver_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").$type<ApprovalStatus>().notNull().default("pending"),
    decisionNote: text("decision_note"),
    decidedById: integer("decided_by_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    callbackStatus: text("callback_status"),
    lastRemindedAt: timestamp("last_reminded_at", { withTimezone: true }),
    reminderCount: integer("reminder_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("approvals_external_ref_idx").on(t.source, t.externalRef)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.id)],
);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: timestamp("value", { withTimezone: true }).notNull(),
});

// Continuous stretches of time a user had the app open (used for "online" history).
export const presenceSessions = pgTable(
  "presence_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("presence_user_idx").on(t.userId, t.endedAt), index("presence_started_idx").on(t.startedAt)],
);

// Server-generated settings, e.g. push notification keys when none are configured in the environment.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
