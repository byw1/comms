import { relations } from 'drizzle-orm';
import { users, accounts, sessions } from './auth.js';
import { teams, teamMembers } from './teams.js';
import { inboxes, channelConnections } from './inboxes.js';
import { contacts, contactIdentities } from './contacts.js';
import {
  conversations,
  conversationParticipants,
  conversationTags,
  tags,
} from './conversations.js';
import { messages, attachments, drafts } from './messages.js';

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  teamMemberships: many(teamMembers),
  assignedConversations: many(conversations),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const inboxesRelations = relations(inboxes, ({ many }) => ({
  connections: many(channelConnections),
  conversations: many(conversations),
}));

export const channelConnectionsRelations = relations(channelConnections, ({ one }) => ({
  inbox: one(inboxes, { fields: [channelConnections.inboxId], references: [inboxes.id] }),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  identities: many(contactIdentities),
  conversations: many(conversations),
}));

export const contactIdentitiesRelations = relations(contactIdentities, ({ one }) => ({
  contact: one(contacts, { fields: [contactIdentities.contactId], references: [contacts.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  inbox: one(inboxes, { fields: [conversations.inboxId], references: [inboxes.id] }),
  contact: one(contacts, { fields: [conversations.contactId], references: [contacts.id] }),
  assignee: one(users, { fields: [conversations.assigneeId], references: [users.id] }),
  assignedTeam: one(teams, { fields: [conversations.assignedTeamId], references: [teams.id] }),
  messages: many(messages),
  participants: many(conversationParticipants),
  tags: many(conversationTags),
  drafts: many(drafts),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  authorUser: one(users, { fields: [messages.authorUserId], references: [users.id] }),
  authorContact: one(contacts, { fields: [messages.authorContactId], references: [contacts.id] }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  message: one(messages, { fields: [attachments.messageId], references: [messages.id] }),
}));

export const draftsRelations = relations(drafts, ({ one }) => ({
  conversation: one(conversations, {
    fields: [drafts.conversationId],
    references: [conversations.id],
  }),
  user: one(users, { fields: [drafts.userId], references: [users.id] }),
}));

export const conversationTagsRelations = relations(conversationTags, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationTags.conversationId],
    references: [conversations.id],
  }),
  tag: one(tags, { fields: [conversationTags.tagId], references: [tags.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  conversations: many(conversationTags),
}));
