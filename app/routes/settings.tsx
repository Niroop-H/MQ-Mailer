// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Badge, Button, Input, Loader, useKumoToastManager } from "@cloudflare/kumo";
import { RobotIcon, ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "~/services/api";
import { queryKeys } from "~/queries/keys";
import { useParams } from "react-router";
import { useMailbox, useUpdateMailbox } from "~/queries/mailboxes";

// Placeholder shown in the textarea when no custom prompt is set.
// The authoritative default prompt lives in workers/agent/index.ts (DEFAULT_SYSTEM_PROMPT).
const PROMPT_PLACEHOLDER = `You are an email assistant that helps manage this inbox. You read emails, draft replies, and help organize conversations.\n\nWrite like a real person. Short, direct, flowing prose. Plain text only.\n\n(Leave empty to use the full built-in default prompt)`;

export default function SettingsRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const toastManager = useKumoToastManager();
	const { data: mailbox } = useMailbox(mailboxId);
	const updateMailboxMutation = useUpdateMailbox();
	const { data: configData } = useQuery({ queryKey: queryKeys.config, queryFn: api.getConfig, staleTime: Infinity });
	const isAdmin = configData?.isAdmin === true;
	const { data: accessPolicy, refetch: reloadAccess } = useQuery({
		queryKey: ["mailboxAccess", mailboxId],
		queryFn: () => api.getMailboxAccess(mailboxId!),
		enabled: isAdmin && !!mailboxId,
	});

	const [displayName, setDisplayName] = useState("");
	const [agentPrompt, setAgentPrompt] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [ownerEmail, setOwnerEmail] = useState("");
	const [membersText, setMembersText] = useState("");
	const [isSavingAccess, setIsSavingAccess] = useState(false);

	useEffect(() => {
		if (mailbox) {
			setDisplayName(mailbox.settings?.fromName || mailbox.name || "");
			setAgentPrompt(mailbox.settings?.agentSystemPrompt || "");
		}
	}, [mailbox]);

	useEffect(() => {
		if (accessPolicy) {
			setOwnerEmail(accessPolicy.ownerEmail);
			setMembersText(accessPolicy.members.join("\\n"));
		}
	}, [accessPolicy]);

	const handleSaveAccess = async () => {
		if (!isAdmin || !mailboxId) return;
		setIsSavingAccess(true);
		try {
			await api.updateMailboxAccess(mailboxId, {
				ownerEmail: ownerEmail.trim(),
				members: membersText.split(/[,\\n]+/).map((email) => email.trim()).filter(Boolean),
			});
			await reloadAccess();
			toastManager.add({ title: "Employee access updated" });
		} catch (err) {
			toastManager.add({ title: err instanceof Error ? err.message : "Unable to update employee access", variant: "error" });
		} finally { setIsSavingAccess(false); }
	};

	const handleSave = async () => {
		if (!mailbox || !mailboxId) return;
		setIsSaving(true);
		const settings = {
			...mailbox.settings,
			fromName: displayName,
			agentSystemPrompt: agentPrompt.trim() || undefined,
		};
		try {
			await updateMailboxMutation.mutateAsync({ mailboxId, settings });
			toastManager.add({ title: "Settings saved!" });
		} catch {
			toastManager.add({
				title: "Failed to save settings",
				variant: "error",
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleResetPrompt = () => {
		setAgentPrompt("");
	};

	if (!mailbox) {
		return (
			<div className="flex justify-center py-20">
				<Loader size="lg" />
			</div>
		);
	}

	const isCustomPrompt = agentPrompt.trim().length > 0;

	return (
		<div className="max-w-2xl px-4 py-4 md:px-8 md:py-6 h-full overflow-y-auto">
			<h1 className="text-lg font-semibold text-kumo-default mb-6">Settings</h1>

			<div className="space-y-6">
				{/* Account */}
				<div className="rounded-lg border border-kumo-line bg-kumo-base p-5">
					<div className="text-sm font-medium text-kumo-default mb-4">
						Account
					</div>
					<div className="space-y-3">
						<Input
							label="Display Name"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
						/>
						<Input label="Email" type="email" value={mailbox.email} disabled />
					</div>
				</div>

				{isAdmin && (
					<div className="rounded-lg border border-kumo-line bg-kumo-base p-5">
						<div className="text-sm font-semibold text-kumo-default mb-2">Employee access &amp; shared mailboxes</div>
						<p className="text-xs text-kumo-subtle mb-4">Only the administrator can assign an owner or authorized team members. Enter their exact Cloudflare Access sign-in emails. Existing mailboxes without an owner remain admin-only.</p>
						<div className="space-y-3">
							<Input label="Owner's sign-in email" type="email" value={ownerEmail} placeholder="employee@example.com" onChange={(e) => setOwnerEmail(e.target.value)} />
							<div>
								<label htmlFor="mq-members" className="block text-sm font-medium mb-1">Additional members (one email per line)</label>
								<textarea id="mq-members" className="w-full rounded-md border border-kumo-line bg-kumo-base px-3 py-2 text-sm" rows={4} value={membersText} onChange={(e) => setMembersText(e.target.value)} placeholder="teammate@example.com" />
							</div>
							<Button variant="primary" loading={isSavingAccess} disabled={!ownerEmail.trim()} onClick={handleSaveAccess}>Save mailbox access</Button>
						</div>
					</div>
				)}

				{/* Agent System Prompt */}
				<div className="rounded-lg border border-kumo-line bg-kumo-base p-5">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<RobotIcon size={16} weight="duotone" className="text-kumo-subtle" />
							<span className="text-sm font-medium text-kumo-default">
								AI Agent Prompt
							</span>
							{isCustomPrompt ? (
								<Badge variant="primary">Custom</Badge>
							) : (
								<Badge variant="secondary">Default</Badge>
							)}
						</div>
						{isCustomPrompt && (
							<Button
								variant="ghost"
								size="xs"
								icon={<ArrowCounterClockwiseIcon size={14} />}
								onClick={handleResetPrompt}
							>
								Reset to default
							</Button>
						)}
					</div>
					<p className="text-xs text-kumo-subtle mb-3">
						Customize how the AI agent behaves for this mailbox.
						Leave empty to use the built-in default prompt.
					</p>
					<textarea
						value={agentPrompt}
						onChange={(e) => setAgentPrompt(e.target.value)}
						placeholder={PROMPT_PLACEHOLDER}
						rows={12}
						className="w-full resize-y rounded-lg border border-kumo-line bg-kumo-recessed px-3 py-2 text-xs text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:ring-1 focus:ring-kumo-ring font-mono leading-relaxed"
					/>
					<p className="text-xs text-kumo-subtle mt-2">
						The prompt is sent as the system message to the AI model.
						It controls the agent's personality, writing style, and behavior rules.
					</p>
				</div>

				{/* Save */}
				<div className="flex justify-end">
					<Button variant="primary" onClick={handleSave} loading={isSaving}>
						Save Changes
					</Button>
				</div>
			</div>
		</div>
	);
}
